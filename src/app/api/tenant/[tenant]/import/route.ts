import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { db, getTenantDb } from "@/lib/database"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { invalidatePattern } from "@/lib/cache"
import { assertSchemaEditable } from "@/lib/schema-lock"
import { orderBackupGroups, restoreBackupContent, restoreBackupLocales, workspaceBackupSchema } from "@/lib/workspace-backup"

export const POST = withStaffAuth(
  async (request, _context, { access }) => {
    let file: FormDataEntryValue | null
    try {
      file = (await request.formData()).get("file")
    } catch {
      return apiError("validation", { message: "Unggah berkas cadangan JSON." })
    }
    if (!(file instanceof File)) return apiError("validation", { message: "Berkas cadangan belum dipilih." })

    let payload: unknown
    try {
      payload = JSON.parse(await file.text())
    } catch {
      return apiError("validation", { message: "Berkas cadangan bukan JSON yang valid." })
    }
    const parsed = workspaceBackupSchema.safeParse(payload)
    if (!parsed.success) {
      return apiError("validation", {
        message: "Format cadangan workspace tidak valid.",
        details: { fields: parsed.error.issues.slice(0, 15).map(issue => ({ field: issue.path.join("."), message: issue.message })) },
      })
    }
    const groups = orderBackupGroups(parsed.data.data.contentTypeGroups)
    if (!groups) {
      return apiError("validation", { message: "Hierarki grup koleksi di cadangan tidak valid." })
    }

    const tenantId = access.tenantId
    const tenantSlug = access.tenant.slug
    const lockError = await assertSchemaEditable(tenantId)
    if (lockError) return apiError("conflict", { message: lockError.error })

    const tenantDb = await getTenantDb(tenantId)
    const { locales } = parsed.data.data
    const result = await tenantDb.$transaction(async tx => {
      const restored = await restoreBackupContent(tx, tenantId, parsed.data, groups)
      if (tenantDb === db) await restoreBackupLocales(tx, tenantId, locales)
      return restored
    }, { timeout: 30000 })

    // In a dedicated workspace, content and locale settings use different
    // databases. Restore content first so the same backup can safely retry
    // the locale step without duplicating the data.
    if (tenantDb !== db && locales.length > 0) {
      try {
        await db.$transaction(tx => restoreBackupLocales(tx, tenantId, locales), { timeout: 30000 })
      } catch (error) {
        console.error("Could not restore workspace backup locales:", error)
        result.skipped.push({ section: "locales", count: locales.length, reason: "Bahasa belum dipulihkan. Coba ulang impor berkas yang sama." })
      }
    }
    result.imported.locales = result.skipped.some(section => section.section === "locales") ? 0 : locales.length

    for (const key of new Set([tenantId, tenantSlug])) {
      revalidatePath(`/dashboard/${key}`, "layout")
      await invalidatePattern(`content:${key}:*`)
      await invalidatePattern(`api:${key}:*`)
    }

    return NextResponse.json({ success: true, ...result, partial: result.skipped.length > 0 })
  },
  { minRole: "admin" },
)
