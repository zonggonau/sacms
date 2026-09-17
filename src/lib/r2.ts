import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { db } from "./database"
import { createS3Client } from "./s3-client"

import { getResolvedStorageConfig } from "./settings"

export interface StorageConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  publicUrl: string
}

async function getTenantStorageConfig(tenantSlug: string): Promise<StorageConfig | null> {
  try {
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { storageConfig: true }
    })
    if (tenant?.storageConfig) {
      const config = tenant.storageConfig as unknown as StorageConfig
      if (config.endpoint && config.accessKey && config.secretKey && config.bucket) {
        return config
      }
    }
  } catch (error) {
    console.error(`Failed to fetch storage config for ${tenantSlug}`, error)
  }
  return null
}

async function getS3Client(tenantSlug?: string): Promise<{ s3: S3Client, bucket: string, publicUrl: string, isCustom: boolean }> {
  if (tenantSlug) {
    const customConfig = await getTenantStorageConfig(tenantSlug)
    if (customConfig) {
      const customS3 = createS3Client(customConfig.endpoint, customConfig.accessKey, customConfig.secretKey)
      return { 
        s3: customS3, 
        bucket: customConfig.bucket, 
        publicUrl: customConfig.publicUrl || "", 
        isCustom: true 
      }
    }
  }
  
  const storageConfig = await getResolvedStorageConfig()
  const accountId = storageConfig.accountId || process.env.R2_ACCOUNT_ID || ""
  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : "http://localhost:9000"

  const globalS3 = createS3Client(
    endpoint,
    storageConfig.accessKeyId || process.env.R2_ACCESS_KEY_ID || "",
    storageConfig.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY || "",
  )

  return { 
    s3: globalS3, 
    bucket: storageConfig.bucketName || process.env.R2_BUCKET_NAME || "sacms-media", 
    publicUrl: storageConfig.publicUrl || process.env.R2_PUBLIC_URL || "", 
    isCustom: false 
  }
}

/**
 * Check if global R2 is configured.
 */
export async function isR2Configured(): Promise<boolean> {
  const cfg = await getResolvedStorageConfig()
  return !!(cfg.accountId && cfg.accessKeyId && cfg.secretAccessKey)
}

/**
 * Where a workspace's media goes:
 *   - its own S3 (`tenant.storageConfig`, the managed BYOS service) — keys `upload/<slug>/...`;
 *   - otherwise the platform object storage (MinIO on the SaCMS VPS, `S3_*` env) — one folder
 *     per workspace, keys `<tenantId>/<ext>/<file>`;
 *   - otherwise local disk (development) — keys `upload/<slug>/...` under `public/`.
 * Keys starting with `upload/` are the legacy/local layout; any other key is the platform bucket.
 */
export async function isTenantStorageConfigured(tenantSlug?: string): Promise<boolean> {
  if (!tenantSlug) return false
  const customConfig = await getTenantStorageConfig(tenantSlug)
  return !!customConfig
}

export interface PlatformStorage {
  s3: S3Client
  bucket: string
  publicUrl: string
}

/** The shared object storage for workspace media, or null when `S3_ENDPOINT` is not set. */
export function getPlatformStorage(): PlatformStorage | null {
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  if (!endpoint || !accessKeyId || !secretAccessKey) return null
  return {
    s3: createS3Client(endpoint, accessKeyId, secretAccessKey, process.env.S3_REGION || "us-east-1"),
    bucket: process.env.S3_BUCKET || "sacms-media",
    publicUrl: process.env.S3_PUBLIC_URL || "",
  }
}

/** Keys in the platform bucket start with the workspace id; legacy and local keys with `upload/`. */
export function isPlatformStorageKey(key: string): boolean {
  return !key.startsWith("upload/")
}

/** Platform bucket key for a workspace file: `<tenantId>/<ext>/<name>_<timestamp>.<ext>`. */
export function generateTenantMediaKey(tenantId: string, filename: string): string {
  return generateStorageKey(tenantId, filename).replace(/^upload\//, "")
}

/**
 * Generate a storage key for a file.
 */
function generateStorageKey(tenantSlug: string, filename: string): string {
  const parts = filename.split(".")
  const ext = parts.pop()?.toLowerCase() || "bin"
  const baseName = parts.join(".").replace(/[^a-z0-9]/gi, "_").toLowerCase()
  const timestamp = Date.now()
  // The per-extension folder is deliberately NOT dot-prefixed (it used to be
  // `.${ext}`, e.g. a literal `.jpg/` directory) — a hidden/dotfile path
  // segment is routinely blocked or given special handling by CDNs, WAFs,
  // and static file servers (nginx's default `location ~ /\.` deny rule is
  // the classic example), which can make a perfectly-written local upload
  // 404/403 at the edge even though the file exists on disk. Existing keys
  // already stored with the old dot-prefixed folder keep resolving fine —
  // this only changes what NEW uploads generate.
  return `upload/${tenantSlug}/${ext}/${baseName}_${timestamp}.${ext}`
}

/**
 * Extract tenant slug from storage key
 */
function extractTenantSlug(key: string): string | null {
  const parts = key.split("/")
  if (parts.length >= 2 && parts[0] === "upload") {
    return parts[1]
  }
  return null
}

/**
 * Build CDN URL from storage key.
 */
function buildUrl(key: string, publicUrl: string, isCustom: boolean): string {
  if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/${key}`
  return `/api/media/serve?key=${key}`
}


export interface UploadResult {
  url: string
  storageKey: string
  thumbnailUrl: string | null
  mediumUrl: string | null
  width: number | null
  height: number | null
  /** Bytes of the generated thumbnail and medium versions. */
  variantBytes: number
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
  const { s3, bucket, publicUrl, isCustom } = await getS3Client(tenantSlug)
  return putWithVariants(s3, bucket, publicUrl, isCustom, generateStorageKey(tenantSlug, filename), buffer, mimeType)
}

/**
 * Upload workspace media: to the workspace's own S3 when it has one, else to its folder in the
 * platform object storage, else to local disk.
 */
export async function uploadTenantMedia(
  tenant: { id: string; slug: string },
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  if (await isTenantStorageConfigured(tenant.slug)) return uploadToR2(tenant.slug, buffer, filename, mimeType)
  const platform = getPlatformStorage()
  if (platform) {
    return putWithVariants(platform.s3, platform.bucket, platform.publicUrl, false, generateTenantMediaKey(tenant.id, filename), buffer, mimeType)
  }
  return uploadToLocal(tenant.slug, buffer, filename, mimeType)
}

async function putWithVariants(
  s3: S3Client,
  bucket: string,
  publicUrl: string,
  isCustom: boolean,
  storageKey: string,
  buffer: Buffer,
  mimeType: string,
): Promise<UploadResult> {

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    })
  )

  let thumbnailUrl: string | null = null
  let mediumUrl: string | null = null
  let width: number | null = null
  let height: number | null = null
  let variantBytes = 0

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
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbKey, Body: thumbBuffer, ContentType: mimeType }))
      thumbnailUrl = buildUrl(thumbKey, publicUrl, isCustom)
      variantBytes += thumbBuffer.length

      // Medium (600px)
      const medKey = storageKey.replace(/(\.[^.]+)$/, "_medium$1")
      const medBuffer = await sharp(buffer)
        .resize(600, undefined, { withoutEnlargement: true })
        .toBuffer()
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: medKey, Body: medBuffer, ContentType: mimeType }))
      mediumUrl = buildUrl(medKey, publicUrl, isCustom)
      variantBytes += medBuffer.length
    } catch (e) {
      console.error("Thumbnail generation failed:", e)
    }
  }

  return { url: buildUrl(storageKey, publicUrl, isCustom), storageKey, thumbnailUrl, mediumUrl, width, height, variantBytes }
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
  let variantBytes = 0

  if (mimeType.startsWith("image/") && mimeType !== "image/svg+xml") {
    try {
      const metadata = await sharp(buffer).metadata()
      width = metadata.width ?? null
      height = metadata.height ?? null
      const thumbKey = storageKey.replace(/(\.[^.]+)$/, "_thumb$1")
      const thumbPath = path.join(process.cwd(), "public", thumbKey)
      const thumbBuffer = await sharp(buffer).resize(150, undefined, { withoutEnlargement: true }).toBuffer()
      fs.writeFileSync(thumbPath, thumbBuffer)
      thumbnailUrl = `/${thumbKey}`
      variantBytes += thumbBuffer.length
    } catch (e) {
      console.error("Local thumbnail failed:", e)
    }
  }

  return { url: `/${storageKey}`, storageKey, thumbnailUrl, mediumUrl: null, width, height, variantBytes }
}

/**
 * Delete a single file from storage.
 */
async function resolveKeyLocation(storageKey: string): Promise<{ s3: S3Client; bucket: string; isCustom: boolean }> {
  const platform = isPlatformStorageKey(storageKey) ? getPlatformStorage() : null
  if (platform) return { s3: platform.s3, bucket: platform.bucket, isCustom: true }
  const tenantSlug = extractTenantSlug(storageKey)
  return getS3Client(tenantSlug || undefined)
}

export async function deleteFromStorage(storageKey: string): Promise<void> {
  const { s3, bucket, isCustom } = await resolveKeyLocation(storageKey)

  // Tenant-scoped op: only that tenant's own dedicated config counts (see
  // isTenantStorageConfigured) — never fall back to platform-wide R2, or a
  // shared-tier tenant's read/delete/presign would look in the wrong place
  // the moment global R2 happens to be configured for something else.
  if (isCustom) {
    const keys = [
      storageKey,
      storageKey.replace(/(\.[^.]+)$/, "_thumb$1"),
      storageKey.replace(/(\.[^.]+)$/, "_medium$1"),
    ]
    await Promise.all(
      keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {}))
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
export async function deleteTenantStorage(tenant: { id: string; slug: string }): Promise<void> {
  const platform = getPlatformStorage()
  if (platform) await deleteS3Prefix(platform.s3, platform.bucket, `${tenant.id}/`, tenant.slug)
  await deleteLegacyTenantStorage(tenant.slug)
}

async function deleteS3Prefix(s3: S3Client, bucket: string, prefix: string, label: string): Promise<void> {
  try {
    let continuationToken: string | undefined = undefined
    let totalDeleted = 0
    do {
      const list: any = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken }))
      if (list.Contents && list.Contents.length > 0) {
        await s3.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: list.Contents.map((obj: any) => ({ Key: obj.Key })), Quiet: true },
        }))
        totalDeleted += list.Contents.length
      }
      continuationToken = list.NextContinuationToken
    } while (continuationToken)
    if (totalDeleted > 0) console.log(`[Storage] Deleted ${totalDeleted} objects for tenant: ${label}`)
  } catch (e) {
    console.error(`[Storage] S3 cleanup failed for tenant ${label}:`, e)
  }
}

async function deleteLegacyTenantStorage(tenantSlug: string): Promise<void> {
  const prefix = `upload/${tenantSlug}/`
  const { s3, bucket, isCustom } = await getS3Client(tenantSlug)

  // Tenant-scoped op: only that tenant's own dedicated config counts (see
  // isTenantStorageConfigured) — never fall back to platform-wide R2, or a
  // shared-tier tenant's read/delete/presign would look in the wrong place
  // the moment global R2 happens to be configured for something else.
  if (isCustom) {
    try {
      let continuationToken: string | undefined = undefined
      let totalDeleted = 0

      do {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
        const list = await s3.send(listCommand)

        if (list.Contents && list.Contents.length > 0) {
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: list.Contents.map((obj) => ({ Key: obj.Key })),
              Quiet: true,
            },
          })
          await s3.send(deleteCommand)
          totalDeleted += list.Contents.length
        }

        continuationToken = (list as any).NextContinuationToken
      } while (continuationToken)

      if (totalDeleted > 0) {
        console.log(`[Storage] Deleted ${totalDeleted} objects for tenant: ${tenantSlug}`)
      }
    } catch (e) {
      console.error(`[Storage] R2/S3 cleanup failed for tenant ${tenantSlug}:`, e)
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

/**
 * Read a stored object's bytes, regardless of whether it lives in R2/S3 or
 * on local disk — used by /api/media/serve, which is the URL every upload
 * falls back to whenever no public bucket URL is configured (see
 * buildUrl()). Without this, a file actually stored in R2 but referenced
 * via the local-only serve route would 404 forever: the object exists in
 * the bucket, but /api/media/serve used to only ever look on local disk.
 */
export async function readFromStorage(storageKey: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  const { s3, bucket, isCustom } = await resolveKeyLocation(storageKey)

  // Tenant-scoped op: only that tenant's own dedicated config counts (see
  // isTenantStorageConfigured) — never fall back to platform-wide R2, or a
  // shared-tier tenant's read/delete/presign would look in the wrong place
  // the moment global R2 happens to be configured for something else.
  if (isCustom) {
    try {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }))
      if (!res.Body) return null
      const buffer = Buffer.from(await (res.Body as any).transformToByteArray())
      return { buffer, contentType: res.ContentType }
    } catch {
      return null
    }
  }

  const fullPath = path.join(process.cwd(), "public", storageKey)
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null
  return { buffer: fs.readFileSync(fullPath) }
}

/**
 * Generate a presigned URL for private R2 objects.
 */
export async function generatePresignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
  const { s3, bucket, isCustom } = await resolveKeyLocation(storageKey)
  
  // Tenant-scoped op: only that tenant's own dedicated config counts (see
  // isTenantStorageConfigured) — never fall back to platform-wide R2, or a
  // shared-tier tenant's read/delete/presign would look in the wrong place
  // the moment global R2 happens to be configured for something else.
  if (isCustom) {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
    return getSignedUrl(s3 as any, command as any, { expiresIn })
  }
  
  // Fallback for local storage: internal proxy route
  return `/api/media/serve?key=${storageKey}`
}

