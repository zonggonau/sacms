import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

type Context = { params: Promise<{ tenant: string }> }

export async function POST(request: NextRequest, context: Context) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await context.params
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    const formData = await request.formData()
    const file = formData.get("file") as File
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const text = await file.text()
    const payload = JSON.parse(text)

    if (payload.version !== "1.0" || !payload.data) {
      return NextResponse.json({ error: "Invalid export file format" }, { status: 400 })
    }

    const { data } = payload

    // We use a transaction to rollback if anything fails
    await tenantDb.$transaction(async (tx) => {
      
      // 1. Locales
      if (data.locales) {
        for (const loc of data.locales) {
          await tx.tenantLocale.upsert({
            where: { tenantId_locale: { tenantId, locale: loc.locale } },
            update: { name: loc.name, isDefault: loc.isDefault, isEnabled: loc.isEnabled },
            create: { tenantId, locale: loc.locale, name: loc.name, isDefault: loc.isDefault, isEnabled: loc.isEnabled },
          })
        }
      }

      // 2. Content Types
      const contentTypeIdMap: Record<string, string> = {}
      if (data.contentTypes) {
        for (const ct of data.contentTypes) {
          const upserted = await tx.contentType.upsert({
            where: { tenantId_slug: { tenantId, slug: ct.slug } },
            update: { name: ct.name, description: ct.description, isPublished: ct.isPublished },
            create: { tenantId, name: ct.name, slug: ct.slug, description: ct.description, isPublished: ct.isPublished },
          })
          contentTypeIdMap[ct.id] = upserted.id

          // Upsert fields
          if (ct.fields) {
            // Delete existing fields first to avoid complex merging
            await tx.schemaField.deleteMany({ where: { contentTypeId: upserted.id } })
            for (const field of ct.fields) {
              await tx.schemaField.create({
                data: {
                  contentTypeId: upserted.id,
                  name: field.name,
                  slug: field.slug,
                  type: field.type,
                  required: field.required,
                  unique: field.unique,
                  localizable: field.localizable,
                  options: field.options,
                  jsonPath: field.jsonPath,
                  relationSlug: field.relationSlug,
                  order: field.order,
                }
              })
            }
          }
        }
      }

      // 3. Content Entries
      if (data.contentEntries) {
        for (const entry of data.contentEntries) {
          const newContentTypeId = contentTypeIdMap[entry.contentTypeId]
          if (!newContentTypeId) continue // skip if content type is missing

          // Upsert based on documentId + locale if it exists, otherwise just insert
          if (entry.documentId) {
            const existing = await tx.contentEntry.findFirst({
              where: { tenantId, documentId: entry.documentId, locale: entry.locale }
            })
            if (existing) {
              await tx.contentEntry.update({
                where: { id: existing.id },
                data: { data: entry.data, status: entry.status }
              })
            } else {
              await tx.contentEntry.create({
                data: {
                  tenantId,
                  contentTypeId: newContentTypeId,
                  documentId: entry.documentId,
                  locale: entry.locale,
                  data: entry.data,
                  status: entry.status,
                  createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
                }
              })
            }
          } else {
            await tx.contentEntry.create({
              data: {
                tenantId,
                contentTypeId: newContentTypeId,
                locale: entry.locale,
                data: entry.data,
                status: entry.status,
                createdAt: entry.createdAt ? new Date(entry.createdAt) : undefined,
              }
            })
          }
        }
      }
      
      // Additional entities (Single Types, Components, Media) could be added here following the same pattern
    }, {
      timeout: 30000, // allow 30 seconds for large imports
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json({ error: "Failed to import data or constraint violation" }, { status: 500 })
  }
}
