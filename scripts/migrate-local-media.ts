/**
 * Move workspace media from local disk (`public/upload/<slug>/...`) to the platform object
 * storage (MinIO, `S3_*` env), into the workspace's folder `<tenantId>/...`, and point the media
 * rows at the new keys. Local files are left in place; delete the volume by hand once verified.
 *
 * Self-contained (no `src/` imports) so it runs inside the production image:
 *   docker compose run --rm app bun scripts/migrate-local-media.ts           # dry run
 *   docker compose run --rm app bun scripts/migrate-local-media.ts --apply
 *
 * Skips workspaces with their own storage (`storageConfig`) and rows already on the platform.
 */
import fs from "fs"
import path from "path"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

export interface MediaRow {
  id: string
  tenantId: string
  url: string
  thumbnailUrl: string | null
  mediumUrl: string | null
  storageKey: string | null
  mimeType?: string | null
}

export interface MediaMove {
  mediaId: string
  /** Files to copy: local key (relative to public/) → platform key. */
  objects: { from: string; to: string }[]
  update: { storageKey: string; url: string; thumbnailUrl: string | null; mediumUrl: string | null }
}

function variantKey(key: string, suffix: "_thumb" | "_medium"): string {
  return key.replace(/(\.[^.]+)$/, `${suffix}$1`)
}

function publicUrlFor(key: string, publicUrl: string): string {
  return publicUrl ? `${publicUrl.replace(/\/$/, "")}/${key}` : `/api/media/serve?key=${key}`
}

/** What to copy and write for one media row, or null when it does not live on local disk. */
export function planMediaMove(row: MediaRow, tenantSlug: string, publicUrl: string, exists: (localKey: string) => boolean): MediaMove | null {
  const localKey = row.storageKey || (row.url.startsWith("/upload/") ? row.url.slice(1) : null)
  const prefix = `upload/${tenantSlug}/`
  if (!localKey || !localKey.startsWith(prefix) || !exists(localKey)) return null

  const newKey = `${row.tenantId}/${localKey.slice(prefix.length)}`
  const objects = [{ from: localKey, to: newKey }]
  let thumbnailUrl: string | null = null
  let mediumUrl: string | null = null
  for (const suffix of ["_thumb", "_medium"] as const) {
    const from = variantKey(localKey, suffix)
    if (!exists(from)) continue
    const to = variantKey(newKey, suffix)
    objects.push({ from, to })
    if (suffix === "_thumb") thumbnailUrl = publicUrlFor(to, publicUrl)
    else mediumUrl = publicUrlFor(to, publicUrl)
  }
  return {
    mediaId: row.id,
    objects,
    update: { storageKey: newKey, url: publicUrlFor(newKey, publicUrl), thumbnailUrl, mediumUrl },
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const endpoint = process.env.S3_ENDPOINT
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const bucket = process.env.S3_BUCKET || "sacms-media"
  const publicUrl = process.env.S3_PUBLIC_URL || ""
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set")
  }

  const { PrismaClient } = await import("../prisma/generated-client")
  const db = new PrismaClient()
  const s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  })
  const publicDir = path.join(process.cwd(), "public")
  const exists = (key: string) => fs.existsSync(path.join(publicDir, key))

  try {
    const tenants = await db.tenant.findMany({ select: { id: true, slug: true, storageConfig: true } })
    let moved = 0
    let skipped = 0
    for (const tenant of tenants) {
      if (tenant.storageConfig) continue
      const rows = await db.media.findMany({
        where: { tenantId: tenant.id },
        select: { id: true, tenantId: true, url: true, thumbnailUrl: true, mediumUrl: true, storageKey: true, mimeType: true },
      })
      for (const row of rows) {
        const move = planMediaMove(row as MediaRow, tenant.slug, publicUrl, exists)
        if (!move) {
          skipped++
          continue
        }
        console.log(`${apply ? "move" : "would move"} ${tenant.slug}: ${move.objects.map((o) => `${o.from} → ${o.to}`).join(", ")}`)
        if (apply) {
          for (const object of move.objects) {
            await s3.send(new PutObjectCommand({
              Bucket: bucket,
              Key: object.to,
              Body: fs.readFileSync(path.join(publicDir, object.from)),
              ContentType: (row as MediaRow).mimeType || undefined,
            }))
          }
          await db.media.update({ where: { id: move.mediaId }, data: move.update })
        }
        moved++
      }
    }
    console.log(`${apply ? "Moved" : "Would move"} ${moved} media; skipped ${skipped} (not on local disk).`)
    if (!apply) console.log("Dry run. Re-run with --apply to copy files and update media rows.")
  } finally {
    await db.$disconnect()
  }
}

if ((import.meta as any).main) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
