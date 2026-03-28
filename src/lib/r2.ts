import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3"
import sharp from "sharp"
import fs from "fs"
import path from "path"

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || ""
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID || ""
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || ""
const R2_BUCKET = process.env.R2_BUCKET_NAME || "sacms-media"
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || "" // CDN URL e.g. https://media.sacms.dev

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ACCOUNT_ID
    ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
    : "http://localhost:9000", // dev fallback
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
})

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY)
}

/**
 * Generate a storage key for a file.
 */
function generateStorageKey(tenantSlug: string, filename: string): string {
  const parts = filename.split(".")
  const ext = parts.pop()?.toLowerCase() || "bin"
  const baseName = parts.join(".").replace(/[^a-z0-9]/gi, "_").toLowerCase()
  const timestamp = Date.now()
  return `upload/${tenantSlug}/.${ext}/${baseName}_${timestamp}.${ext}`
}

/**
 * Build CDN URL from storage key.
 */
function buildUrl(key: string): string {
  if (R2_PUBLIC_URL) return `${R2_PUBLIC_URL}/${key}`
  if (R2_ACCOUNT_ID) return `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${key}`
  return `/api/media/serve?key=${key}`
}

export interface UploadResult {
  url: string
  storageKey: string
  thumbnailUrl: string | null
  mediumUrl: string | null
  width: number | null
  height: number | null
}

/**
 * Upload a file to R2 with optional image resizing.
 */
export async function uploadToR2(
  tenantSlug: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const storageKey = generateStorageKey(tenantSlug, filename)

  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    })
  )

  let thumbnailUrl: string | null = null
  let mediumUrl: string | null = null
  let width: number | null = null
  let height: number | null = null

  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
    try {
      const metadata = await sharp(buffer).metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null

      // Thumbnail (150px)
      const thumbKey = storageKey.replace(/(\.[^.]+)$/, "_thumb$1")
      const thumbBuffer = await sharp(buffer)
        .resize(150, undefined, { withoutEnlargement: true })
        .toBuffer()
      await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: thumbKey, Body: thumbBuffer, ContentType: mimeType }))
      thumbnailUrl = buildUrl(thumbKey)

      // Medium (600px)
      const medKey = storageKey.replace(/(\.[^.]+)$/, "_medium$1")
      const medBuffer = await sharp(buffer)
        .resize(600, undefined, { withoutEnlargement: true })
        .toBuffer()
      await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: medKey, Body: medBuffer, ContentType: mimeType }))
      mediumUrl = buildUrl(medKey)
    } catch (e) {
      console.error("Thumbnail generation failed:", e)
    }
  }

  return { url: buildUrl(storageKey), storageKey, thumbnailUrl, mediumUrl, width, height }
}

/**
 * Fallback: Upload to local disk.
 */
export async function uploadToLocal(
  tenantSlug: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const storageKey = generateStorageKey(tenantSlug, filename)
  const fullPath = path.join(process.cwd(), "public", storageKey)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, buffer)

  let thumbnailUrl: string | null = null
  let width: number | null = null
  let height: number | null = null

  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
    try {
      const metadata = await sharp(buffer).metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null
      const thumbKey = storageKey.replace(/(\.[^.]+)$/, "_thumb$1")
      const thumbPath = path.join(process.cwd(), "public", thumbKey)
      await sharp(buffer).resize(150, undefined, { withoutEnlargement: true }).toFile(thumbPath)
      thumbnailUrl = `/${thumbKey}`
    } catch (e) {
      console.error("Local thumbnail failed:", e)
    }
  }

  return { url: `/${storageKey}`, storageKey, thumbnailUrl, mediumUrl: null, width, height }
}

/**
 * Delete a single file from storage.
 */
export async function deleteFromStorage(storageKey: string): Promise<void> {
  if (isR2Configured()) {
    const keys = [
      storageKey,
      storageKey.replace(/(\.[^.]+)$/, "_thumb$1"),
      storageKey.replace(/(\.[^.]+)$/, "_medium$1"),
    ]
    await Promise.all(
      keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key })).catch(() => {}))
    )
  } else {
    try {
      const fullPath = path.join(process.cwd(), "public", storageKey)
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
      const thumbPath = path.join(process.cwd(), "public", storageKey.replace(/(\.[^.]+)$/, "_thumb$1"))
      if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
    } catch (e) {
      console.error("Local delete failed:", e)
    }
  }
}

/**
 * Delete all files associated with a tenant (full directory cleanup).
 */
export async function deleteTenantStorage(tenantSlug: string): Promise<void> {
  const prefix = `upload/${tenantSlug}/`

  if (isR2Configured()) {
    try {
      const listCommand = new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix })
      const list = await s3.send(listCommand)

      if (list.Contents && list.Contents.length > 0) {
        const deleteCommand = new DeleteObjectsCommand({
          Bucket: R2_BUCKET,
          Delete: { Objects: list.Contents.map((obj) => ({ Key: obj.Key })) },
        })
        await s3.send(deleteCommand)
        console.log(`[Storage] Deleted ${list.Contents.length} objects for tenant: ${tenantSlug}`)
      }
    } catch (e) {
      console.error(`[Storage] R2 cleanup failed for tenant ${tenantSlug}:`, e)
    }
  } else {
    try {
      const tenantPath = path.join(process.cwd(), "public", "upload", tenantSlug)
      if (fs.existsSync(tenantPath)) {
        fs.rmSync(tenantPath, { recursive: true, force: true })
        console.log(`[Storage] Deleted local directory for tenant: ${tenantSlug}`)
      }
    } catch (e) {
      console.error(`[Storage] Local cleanup failed for tenant ${tenantSlug}:`, e)
    }
  }
}
