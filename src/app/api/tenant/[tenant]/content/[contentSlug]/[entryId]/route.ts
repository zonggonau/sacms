import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { logAudit, AuditAction } from "@/lib/audit-log"
import { validateBody } from "@/lib/validate"
import { updateContentEntrySchema } from "@/lib/validations"
import { revalidatePath } from "next/cache"

type Params = {
  tenant: string
  contentSlug: string
  entryId: string
}

// GET single entry (with locale support)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params
    const { searchParams } = new URL(request.url)
    const locale = searchParams.get("locale") || "en"

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Find the requested entry first to get its documentId
    const baseEntry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, tenantId: tenantId },
    })

    if (!baseEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const documentId = baseEntry.documentId || baseEntry.id

    // Now find the entry with the requested locale
    let entry = await tenantDb.contentEntry.findFirst({
      where: { documentId, locale, tenantId: tenantId },
    })

    // If not found, we return the base entry but mark it as a new translation template
    let isNewTranslation = false
    if (!entry) {
      entry = baseEntry
      isNewTranslation = true
    }

    return NextResponse.json({ entry, isNewTranslation, documentId })
  } catch (error) {
    console.error("Error fetching entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT - Update or Create Translation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params
    
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const result = await validateBody(request, updateContentEntrySchema)
    if ("error" in result) return result.error
    
    // Custom handling for locale in body
    const body = await request.clone().json()
    const locale = body.locale || "en"
    const { data, publish } = result.data

    const contentType = await db.contentType.findFirst({
      where: { slug: contentSlug },
      include: { fields: true }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    // Find base entry to get documentId
    const baseEntry = await tenantDb.contentEntry.findUnique({
      where: { id: entryId }
    })
    if (!baseEntry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    const documentId = baseEntry.documentId || baseEntry.id

    // Upsert the entry for this specific locale
    const entry = await tenantDb.$transaction(async (tx) => {
      // Check if this locale version already exists
      const existingLocaleEntry = await tx.contentEntry.findFirst({
        where: { documentId, locale, tenantId }
      })

      let targetEntryId = existingLocaleEntry?.id

      if (existingLocaleEntry) {
        // Update existing
        await tx.contentEntry.update({
          where: { id: existingLocaleEntry.id },
          data: {
            data: JSON.stringify(data),
            publishedAt: publish === true ? new Date() : publish === false ? null : existingLocaleEntry.publishedAt,
            updatedBy: session.user.id,
          },
        })
      } else {
        // Create new translation
        const newEntry = await tx.contentEntry.create({
          data: {
            documentId,
            contentTypeId: baseEntry.contentTypeId,
            tenantId,
            locale,
            data: JSON.stringify(data),
            status: "DRAFT",
            publishedAt: publish ? new Date() : null,
            createdBy: session.user.id,
          }
        })
        targetEntryId = newEntry.id
      }

      // Sync Shared Fields (localizable: false) across all translations of this document
      const sharedFields = contentType.fields.filter(f => !f.localizable)
      if (sharedFields.length > 0) {
        const translations = await tx.contentEntry.findMany({
          where: { documentId, NOT: { id: targetEntryId! } }
        })

        for (const trans of translations) {
          let transData = typeof trans.data === 'string' ? JSON.parse(trans.data) : trans.data
          let updated = false
          for (const field of sharedFields) {
            if (data[field.slug] !== transData[field.slug]) {
              transData[field.slug] = data[field.slug]
              updated = true
            }
          }
          if (updated) {
            await tx.contentEntry.update({
              where: { id: trans.id },
              data: { data: JSON.stringify(transData) }
            })
          }
        }
      }

      return await tx.contentEntry.findUnique({ where: { id: targetEntryId! } })
    })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    
    return NextResponse.json({ entry })
  } catch (error) {
    console.error("Error updating/translating entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug, contentSlug, entryId } = await params

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const contentType = await db.contentType.findFirst({
      where: { 
        slug: contentSlug,
        OR: [
          { tenantId: tenantId },
          { tenantId: null }
        ]
      }
    })
    if (!contentType) return NextResponse.json({ error: "Content type not found" }, { status: 404 })

    const entry = await tenantDb.contentEntry.findFirst({
      where: { id: entryId, contentTypeId: contentType.id, tenantId: tenantId },
    })
    if (!entry) return NextResponse.json({ error: "Entry not found" }, { status: 404 })

    await tenantDb.contentEntry.delete({ where: { id: entryId } })

    const { invalidatePattern } = await import("@/lib/cache")
    await invalidatePattern(`public_api:${tenantSlug}:${contentSlug}:*`)
    revalidatePath("/")

    logAudit({
      tenantId: tenantId,
      userId: session.user.id,
      action: AuditAction.CONTENT_DELETED,
      entity: "ContentEntry",
      entityId: entryId,
      data: { contentType: contentSlug },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting entry:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
