import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  DeleteBucketCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import sharp from "sharp"
import fs from "fs"
import path from "path"
import { db } from "./database"
import { createS3Client } from "./s3-client"

export interface StorageConfig {
  endpoint: string
  accessKey: string
  secretKey: string
  bucket: string
  publicUrl: string
}

// ─── Dedicated enterprise storage ────────────────────────────────────────
// A tenant's own S3-compatible bucket, provisioned by SaCMS's own ops team
// as part of the paid "Database & Storage" managed infra add-on (see
// lib/billing/managed-infra.ts) — not something a tenant configures from
// outside. Every other workspace uses the platform's own MinIO below.

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

/**
 * Where a workspace's media goes:
 *   - its own dedicated bucket (`tenant.storageConfig`, the managed enterprise
 *     infra add-on) — keys `<tenantId>/<ext>/...`;
 *   - otherwise its own auto-provisioned bucket on the platform's MinIO
 *     (`sacms-tenant-<tenantId>`, see getTenantObjectStorage) — same key
 *     layout;
 *   - otherwise local disk (development, no S3_* configured) — keys
 *     `upload/<slug>/...` under `public/`.
 * Keys starting with `upload/` are the legacy/local layout; any other key is
 * an object-storage key, `<tenantId>/...`.
 */
export async function isTenantStorageConfigured(tenantSlug?: string): Promise<boolean> {
  if (!tenantSlug) return false
  const customConfig = await getTenantStorageConfig(tenantSlug)
  return !!customConfig
}

// ─── Platform object storage (MinIO) ─────────────────────────────────────
// The only storage backend SaCMS Cloud uses day to day — no Cloudflare R2,
// no externally-configured provider. This is the `minio` service in
// docker-compose.yml, reached through the S3-compatible API via S3_* env
// vars (see .env.example).

export interface PlatformStorage {
  s3: S3Client
  bucket: string
  publicUrl: string
}

/** The shared object storage used for platform-wide, non-tenant-scoped files
 * (avatars, DB backups, support attachments) — or null when `S3_ENDPOINT`
 * isn't set. */
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

/** Whether MinIO is configured at all — the gate every direct `uploadToSharedStorage` caller checks before falling back to local disk. */
export function isObjectStorageConfigured(): boolean {
  return !!getPlatformStorage()
}

/** Deterministic, stable bucket name for a workspace's own MinIO bucket —
 * derived from the immutable tenant id (not the editable slug), so renaming
 * a workspace never orphans its bucket. Bucket names must be lowercase;
 * cuid() already only ever produces lowercase alphanumerics. */
export function getTenantBucketName(tenantId: string): string {
  return `sacms-tenant-${tenantId}`.toLowerCase()
}

/** Creates the bucket (and a public-read policy, matching the shared
 * bucket's `mc anonymous set download`) if it doesn't exist yet. Idempotent
 * — safe to call on every upload. */
async function ensureBucketExists(s3: S3Client, bucket: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
    return
  } catch {
    // Doesn't exist (or HEAD isn't permitted) — try to create it below.
  }

  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  } catch (err: any) {
    // Created concurrently by another request, or already exists — fine.
    if (err?.name !== "BucketAlreadyOwnedByYou" && err?.name !== "BucketAlreadyExists") {
      throw err
    }
  }

  try {
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      })
    )
  } catch (err) {
    console.warn(`[Storage] Failed to set public-read policy on bucket ${bucket}:`, err)
  }
}

/** A workspace's own MinIO bucket, auto-created on first use. Returns null
 * only when MinIO itself isn't configured at all. */
export async function getTenantObjectStorage(tenantId: string): Promise<{ s3: S3Client; bucket: string } | null> {
  const platform = getPlatformStorage()
  if (!platform) return null
  const bucket = getTenantBucketName(tenantId)
  await ensureBucketExists(platform.s3, bucket)
  return { s3: platform.s3, bucket }
}

/** Resolves the shared bucket for a platform-wide, non-tenant upload
 * (avatars, backups, support attachments), or a tenant's dedicated
 * enterprise bucket when it has one configured. */
async function getSharedS3Client(tenantSlug?: string): Promise<{ s3: S3Client; bucket: string; publicUrl: string; isCustom: boolean }> {
  if (tenantSlug) {
    const customConfig = await getTenantStorageConfig(tenantSlug)
    if (customConfig) {
      const customS3 = createS3Client(customConfig.endpoint, customConfig.accessKey, customConfig.secretKey)
      return { s3: customS3, bucket: customConfig.bucket, publicUrl: customConfig.publicUrl || "", isCustom: true }
    }
  }

  const platform = getPlatformStorage()
  if (!platform) {
    throw new Error(
      "Object storage (MinIO) belum dikonfigurasi — set S3_ENDPOINT, S3_ACCESS_KEY_ID, dan S3_SECRET_ACCESS_KEY di environment server."
    )
  }
  return { s3: platform.s3, bucket: platform.bucket, publicUrl: platform.publicUrl, isCustom: false }
}

/** Keys outside the platform bucket layout start with `upload/` (legacy/local). */
export function isPlatformStorageKey(key: string): boolean {
  return !key.startsWith("upload/")
}

/** Validated mimeType -> safe extension, so a stored file's extension
 * reflects what the bytes actually are rather than whatever extension the
 * uploader's filename happened to carry (which the client fully controls). */
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
}

/** Platform-bucket key for a workspace file: `<tenantId>/<ext>/<name>_<timestamp>.<ext>`. */
export function generateTenantMediaKey(tenantId: string, filename: string, mimeType?: string): string {
  return generateStorageKey(tenantId, filename, mimeType).replace(/^upload\//, "")
}

/**
 * Generate a storage key for a file. `mimeType`, when given, picks the
 * extension from EXTENSION_BY_MIME instead of trusting the filename's own
 * extension — falls back to the filename only for types with no map entry
 * (e.g. application/octet-stream never reaches here unvalidated any more,
 * but third-party callers might still omit mimeType).
 */
function generateStorageKey(tenantSlug: string, filename: string, mimeType?: string): string {
  const parts = filename.split(".")
  const filenameExt = parts.pop()?.toLowerCase() || "bin"
  const ext = (mimeType && EXTENSION_BY_MIME[mimeType]) || filenameExt
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
 * Extract tenant slug from a legacy/local storage key.
 */
function extractTenantSlug(key: string): string | null {
  const parts = key.split("/")
  if (parts.length >= 2 && parts[0] === "upload") {
    return parts[1]
  }
  return null
}

/**
 * Extract the tenant id from a platform-bucket key (`<tenantId>/<ext>/...`).
 */
function extractTenantIdFromPlatformKey(key: string): string | null {
  const parts = key.split("/")
  return parts[0] || null
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
 * Upload a file to the shared platform bucket (or a tenant's dedicated
 * enterprise bucket when `tenantSlug` matches one), with optional image
 * resizing. Used for platform-wide, non-tenant-scoped files — avatars, DB
 * backups, support attachments — never for the workspace media library
 * (see uploadTenantMedia, which gets each workspace its own MinIO bucket).
 */
export async function uploadToSharedStorage(
  tenantSlug: string,
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const { s3, bucket, publicUrl, isCustom } = await getSharedS3Client(tenantSlug)
  return putWithVariants(s3, bucket, publicUrl, isCustom, generateStorageKey(tenantSlug, filename, mimeType), buffer, mimeType)
}

/**
 * Upload workspace media: to the workspace's own dedicated bucket when it
 * has one (enterprise managed infra), else to its own auto-provisioned
 * bucket on the platform's MinIO, else to local disk (dev only).
 */
export async function uploadTenantMedia(
  tenant: { id: string; slug: string },
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  if (await isTenantStorageConfigured(tenant.slug)) return uploadToSharedStorage(tenant.slug, buffer, filename, mimeType)

  const tenantStorage = await getTenantObjectStorage(tenant.id)
  if (tenantStorage) {
    return putWithVariants(tenantStorage.s3, tenantStorage.bucket, "", false, generateTenantMediaKey(tenant.id, filename, mimeType), buffer, mimeType)
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
  const storageKey = generateStorageKey(tenantSlug, filename, mimeType)
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
 * Delete a single file from storage. `tenantId`, when known, lets this check
 * the workspace's own MinIO bucket; callers that don't have it (or keys
 * uploaded before per-workspace buckets existed) fall back to the one
 * shared platform bucket.
 */
export async function deleteFromStorage(storageKey: string, tenantId?: string): Promise<void> {
  if (!isPlatformStorageKey(storageKey)) {
    const tenantSlug = extractTenantSlug(storageKey)
    const { s3, bucket, isCustom } = await getSharedS3Client(tenantSlug || undefined)
    if (isCustom) {
      await deleteKeyAndVariants(s3, bucket, storageKey)
    } else {
      deleteLocalKeyAndVariants(storageKey)
    }
    return
  }

  // Dedicated enterprise bucket, if this workspace has one — takes priority
  // over its MinIO bucket, same as uploadTenantMedia's own resolution order.
  const keyTenantId = tenantId || extractTenantIdFromPlatformKey(storageKey)
  const dedicated = keyTenantId ? await getTenantStorageConfig(keyTenantId).catch(() => null) : null
  if (dedicated) {
    const s3 = createS3Client(dedicated.endpoint, dedicated.accessKey, dedicated.secretKey)
    await deleteKeyAndVariants(s3, dedicated.bucket, storageKey)
    return
  }

  // Best-effort delete from both the workspace's own MinIO bucket and the
  // legacy shared bucket — harmless no-op wherever the key doesn't exist.
  const attempts: Promise<void>[] = []
  if (keyTenantId) {
    const tenantStorage = await getTenantObjectStorage(keyTenantId).catch(() => null)
    if (tenantStorage) attempts.push(deleteKeyAndVariants(tenantStorage.s3, tenantStorage.bucket, storageKey))
  }
  const platform = getPlatformStorage()
  if (platform) attempts.push(deleteKeyAndVariants(platform.s3, platform.bucket, storageKey))
  await Promise.all(attempts)
}

async function deleteKeyAndVariants(s3: S3Client, bucket: string, storageKey: string): Promise<void> {
  const keys = [
    storageKey,
    storageKey.replace(/(\.[^.]+)$/, "_thumb$1"),
    storageKey.replace(/(\.[^.]+)$/, "_medium$1"),
  ]
  await Promise.all(
    keys.map((key) => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => {}))
  )
}

function deleteLocalKeyAndVariants(storageKey: string): void {
  try {
    const fullPath = path.join(process.cwd(), "public", storageKey)
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath)
    const thumbPath = path.join(process.cwd(), "public", storageKey.replace(/(\.[^.]+)$/, "_thumb$1"))
    if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath)
  } catch (e) {
    console.error("Local delete failed:", e)
  }
}

/**
 * Delete all files associated with a tenant: its dedicated bucket (if any),
 * its own MinIO bucket, and anything left over in the legacy shared bucket
 * or local disk from before per-workspace buckets existed.
 */
export async function deleteTenantStorage(tenant: { id: string; slug: string }): Promise<void> {
  const dedicated = await getTenantStorageConfig(tenant.slug)
  if (dedicated) {
    const s3 = createS3Client(dedicated.endpoint, dedicated.accessKey, dedicated.secretKey)
    await deleteS3Prefix(s3, dedicated.bucket, `${tenant.id}/`, tenant.slug)
  }

  const platform = getPlatformStorage()
  if (platform) {
    await deleteAndRemoveBucket(platform.s3, getTenantBucketName(tenant.id), tenant.slug)
    // Pre-existing media uploaded before per-workspace buckets existed.
    await deleteS3Prefix(platform.s3, platform.bucket, `${tenant.id}/`, tenant.slug)
  }

  await deleteLegacyTenantStorage(tenant.slug)
}

/** Empties and removes a workspace's own MinIO bucket entirely. */
async function deleteAndRemoveBucket(s3: S3Client, bucket: string, label: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    return // Bucket never existed — nothing to clean up.
  }
  await deleteS3Prefix(s3, bucket, "", label)
  try {
    await s3.send(new DeleteBucketCommand({ Bucket: bucket }))
  } catch (e) {
    console.error(`[Storage] Failed to delete bucket ${bucket} for tenant ${label}:`, e)
  }
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
    if (totalDeleted > 0) console.log(`[Storage] Deleted ${totalDeleted} objects from ${bucket} for tenant: ${label}`)
  } catch (e) {
    console.error(`[Storage] S3 cleanup failed for tenant ${label} (bucket ${bucket}):`, e)
  }
}

async function deleteLegacyTenantStorage(tenantSlug: string): Promise<void> {
  const prefix = `upload/${tenantSlug}/`
  const dedicated = await getTenantStorageConfig(tenantSlug)

  if (dedicated) {
    const s3 = createS3Client(dedicated.endpoint, dedicated.accessKey, dedicated.secretKey)
    await deleteS3Prefix(s3, dedicated.bucket, prefix, tenantSlug)
    return
  }

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

/**
 * Read a stored object's bytes, regardless of where it lives — used by
 * /api/media/serve, which is the URL every upload falls back to whenever no
 * public bucket URL is configured (see buildUrl()). `tenantId` picks the
 * workspace's own MinIO bucket first, falling back to the legacy shared
 * bucket for media uploaded before per-workspace buckets existed.
 */
export async function readFromStorage(storageKey: string, tenantId?: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  if (!isPlatformStorageKey(storageKey)) {
    const tenantSlug = extractTenantSlug(storageKey)
    const { s3, bucket, isCustom } = await getSharedS3Client(tenantSlug || undefined)
    if (isCustom) return getObjectBuffer(s3, bucket, storageKey)

    const fullPath = path.join(process.cwd(), "public", storageKey)
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) return null
    return { buffer: fs.readFileSync(fullPath) }
  }

  const keyTenantId = tenantId || extractTenantIdFromPlatformKey(storageKey)
  const dedicated = keyTenantId ? await getTenantStorageConfig(keyTenantId).catch(() => null) : null
  if (dedicated) {
    const s3 = createS3Client(dedicated.endpoint, dedicated.accessKey, dedicated.secretKey)
    return getObjectBuffer(s3, dedicated.bucket, storageKey)
  }

  if (keyTenantId) {
    const tenantStorage = await getTenantObjectStorage(keyTenantId).catch(() => null)
    if (tenantStorage) {
      const fromTenantBucket = await getObjectBuffer(tenantStorage.s3, tenantStorage.bucket, storageKey)
      if (fromTenantBucket) return fromTenantBucket
    }
  }

  const platform = getPlatformStorage()
  if (!platform) return null
  return getObjectBuffer(platform.s3, platform.bucket, storageKey)
}

async function getObjectBuffer(s3: S3Client, bucket: string, key: string): Promise<{ buffer: Buffer; contentType?: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!res.Body) return null
    const buffer = Buffer.from(await (res.Body as any).transformToByteArray())
    return { buffer, contentType: res.ContentType }
  } catch {
    return null
  }
}

/**
 * Generate a presigned URL for a private object in a tenant's dedicated
 * enterprise bucket (the only case with no public bucket URL at all).
 */
export async function generatePresignedUrl(storageKey: string, tenantId?: string, expiresIn = 3600): Promise<string> {
  const keyTenantId = tenantId || (isPlatformStorageKey(storageKey) ? extractTenantIdFromPlatformKey(storageKey) : extractTenantSlug(storageKey))
  const dedicated = keyTenantId ? await getTenantStorageConfig(keyTenantId).catch(() => null) : null

  if (dedicated) {
    const s3 = createS3Client(dedicated.endpoint, dedicated.accessKey, dedicated.secretKey)
    const command = new GetObjectCommand({ Bucket: dedicated.bucket, Key: storageKey })
    return getSignedUrl(s3 as any, command as any, { expiresIn })
  }

  // Every other case serves through the internal proxy route instead.
  return `/api/media/serve?key=${storageKey}`
}
