// The SaCMS Next.js starter as a published Website Template, so every workspace can apply it for free.
// Created from the starter repository the first time the catalog is read, then kept as a normal row.
import { db } from "@/lib/database"
import { loadStarterSnapshot, starterLockFor, templateLockKey, writeStarterLock, type StarterSnapshot } from "./starter-template"

export const STARTER_CATALOG_SLUG = "sacms-nextjs-starter"
const STARTER_SCHEMA_SLUG = "sacms-nextjs-starter-schema"
const RETRY_AFTER_FAILURE_MS = 5 * 60_000

let lastFailureAt = 0

/**
 * Makes sure the starter Website Template exists and is published. Cheap once it exists (one query).
 * If GitHub cannot be reached, the failure is remembered for a few minutes so the catalog page does
 * not wait on GitHub on every load. Never throws: the catalog must still load without the starter.
 */
export async function ensureStarterWebsiteTemplate(): Promise<void> {
  const existing = await db.websiteTemplate.findFirst({ where: { isStarter: true }, select: { id: true, published: true } })
  if (existing) {
    if (!existing.published) await db.websiteTemplate.update({ where: { id: existing.id }, data: { published: true } })
    return
  }
  if (Date.now() - lastFailureAt < RETRY_AFTER_FAILURE_MS) return

  let snapshot: StarterSnapshot
  try {
    snapshot = await loadStarterSnapshot()
  } catch (error) {
    lastFailureAt = Date.now()
    console.warn("[starter-catalog] starter tidak bisa dimuat dari GitHub:", error)
    return
  }

  const files = snapshot.files.map((f) => ({ path: f.path, content: f.content, encoding: f.encoding }))
  try {
    await db.$transaction(async (tx) => {
      const schemaTemplate = await tx.schemaTemplate.upsert({
        where: { slug: STARTER_SCHEMA_SLUG },
        update: { schema: snapshot.schema as object, published: true },
        create: {
          name: "SaCMS Next.js Starter",
          slug: STARTER_SCHEMA_SLUG,
          category: "Starter",
          icon: "🧱",
          description: "Schema default starter SaCMS Next.js.",
          schema: snapshot.schema as object,
          published: true,
        },
      })
      const template = await tx.websiteTemplate.create({
        data: {
          name: "SaCMS Next.js Starter",
          slug: STARTER_CATALOG_SLUG,
          schemaTemplateId: schemaTemplate.id,
          icon: "🧱",
          description: "Starter Next.js resmi SaCMS. Gratis untuk semua plan.",
          files: files as object,
          published: true,
          isStarter: true,
        },
      })
      await writeStarterLock(tx, templateLockKey(template.id), null, starterLockFor(snapshot))
    })
  } catch (error) {
    // A concurrent request may have created it first (unique slug); that is the outcome we want.
    console.warn("[starter-catalog] gagal membuat template starter:", error)
  }
}
