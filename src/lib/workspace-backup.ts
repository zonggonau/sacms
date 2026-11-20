import { createHash } from "node:crypto"
import { z } from "zod/v4"
import { Prisma } from "@/lib/database"
import { CONTENT_STATUSES } from "@/lib/content-workflow-rules"

export const BACKUP_VERSION = "1.1"
export const BACKUP_UNSUPPORTED = {
  media: "Metadata hanya sebagai referensi. Berkas dan metadata Media Library tidak dipulihkan.",
  mediaFolders: "Struktur folder disimpan sebagai referensi dan tidak dipulihkan.",
  platformModels: "Skema yang ditetapkan oleh platform mengikuti katalog dan penetapan workspace tujuan.",
  history: "Riwayat versi, reviewer, dan audit log tidak disertakan.",
  workspaceSettings: "Anggota, kunci, integrasi, pembayaran, dan deployment tidak disertakan.",
} as const

const identifier = z.string().min(1).max(200)
const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value)).nullable().optional()
const fieldSchema = z.object({
  name: z.string().min(1), slug: identifier, type: identifier, required: z.boolean().optional(),
  unique: z.boolean().optional(), localizable: z.boolean().optional(), options: z.json().optional(),
  jsonPath: z.string().nullable().optional(), relationSlug: z.string().nullable().optional(), order: z.number().int().optional(),
})
const definition = z.object({
  id: identifier, name: z.string().min(1), slug: identifier, description: z.string().nullable().optional(),
  fields: z.array(fieldSchema).optional(), draftTemplateId: z.string().nullable().optional(),
})
const published = { isPublished: z.boolean().optional(), showInCms: z.boolean().optional() }

export const workspaceBackupSchema = z.object({
  version: z.enum(["1.0", BACKUP_VERSION]),
  tenant: z.object({ id: identifier }).optional(),
  data: z.object({
    locales: z.array(z.object({
      locale: identifier, name: z.string().min(1), isDefault: z.boolean().optional(), isEnabled: z.boolean().optional(),
    })).default([]),
    contentTypeGroups: z.array(z.object({
      id: identifier, name: z.string().min(1), parentId: identifier.nullable().optional(), order: z.number().int().optional(),
    })).default([]),
    contentTypes: z.array(definition.extend({
      ...published, groupId: identifier.nullable().optional(), groupOrder: z.number().int().optional(),
      docxTemplateUrl: z.string().nullable().optional(),
    })).default([]),
    singleTypes: z.array(definition.extend(published)).default([]),
    components: z.array(definition.extend({ category: z.string().nullable().optional() })).default([]),
    contentEntries: z.array(z.object({
      id: identifier.optional(), contentTypeId: identifier, locale: identifier.default("id"),
      documentId: identifier.nullable().optional(), data: z.json(), status: z.enum(CONTENT_STATUSES).optional(),
      publishedAt: date, scheduledAt: date, archivedAt: date, deletedAt: date, createdAt: date, updatedAt: date,
      reviewComment: z.string().nullable().optional(),
      createdBy: identifier.nullable().optional(), updatedBy: identifier.nullable().optional(),
    })).default([]),
    singleTypeData: z.array(z.object({
      singleTypeId: identifier, locale: identifier.default("id"), enabled: z.boolean().optional(),
      data: z.json().optional(), draftData: z.json().optional(), publishedAt: date, createdAt: date, updatedAt: date,
    })).default([]),
    mediaFolders: z.array(z.unknown()).default([]),
    media: z.array(z.unknown()).default([]),
  }),
}).refine(({ data }) => data.locales.filter(locale => locale.isDefault).length <= 1, {
  path: ["data", "locales"], message: "Hanya satu bahasa utama yang dapat dipulihkan.",
})

type WorkspaceBackup = z.output<typeof workspaceBackupSchema>
type BackupField = z.output<typeof fieldSchema>
type Group = WorkspaceBackup["data"]["contentTypeGroups"][number]
type FieldOwner = { contentTypeId: string } | { singleTypeId: string } | { componentId: string }

function nullableJson(value: z.output<ReturnType<typeof z.json>> | undefined) {
  return value === null ? Prisma.DbNull : value
}

function copyId(tenantId: string, sourceTenantId: string | undefined, id: string) {
  if (sourceTenantId === tenantId) return id
  return `restored_${createHash("sha256").update(JSON.stringify([tenantId, sourceTenantId ?? null, id])).digest("hex").slice(0, 32)}`
}

export function orderBackupGroups(groups: Group[]) {
  const byId = new Map(groups.map(group => [group.id, group]))
  if (byId.size !== groups.length) return null

  const depthById = new Map<string, number>()
  for (const group of groups) {
    const ancestors = new Set([group.id])
    let current = group
    while (current.parentId) {
      const parent = byId.get(current.parentId)
      if (!parent || ancestors.has(parent.id) || ancestors.size >= 3) return null
      ancestors.add(parent.id)
      current = parent
    }
    depthById.set(group.id, ancestors.size)
  }
  return groups.toSorted((a, b) => (depthById.get(a.id) ?? 0) - (depthById.get(b.id) ?? 0))
}

function remapReferences(value: z.output<ReturnType<typeof z.json>>, ids: Map<string, string>): Prisma.InputJsonValue | null {
  if (typeof value === "string") return ids.get(value) ?? value
  if (Array.isArray(value)) return value.map(item => remapReferences(item, ids))
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapReferences(item, ids)]))
  }
  return value
}

async function restoreFields(tx: Prisma.TransactionClient, owner: FieldOwner, fields?: BackupField[]) {
  if (!fields) return
  await tx.schemaField.deleteMany({ where: owner })
  if (fields.length) {
    await tx.schemaField.createMany({ data: fields.map(field => ({ ...field, ...owner, options: nullableJson(field.options) })) })
  }
}

export async function restoreBackupLocales(tx: Prisma.TransactionClient, tenantId: string, locales: WorkspaceBackup["data"]["locales"]) {
  const defaultLocale = locales.find(locale => locale.isDefault)
  if (defaultLocale) {
    await tx.tenantLocale.updateMany({ where: { tenantId, locale: { not: defaultLocale.locale }, isDefault: true }, data: { isDefault: false } })
  }
  for (const { locale, ...values } of locales) {
    await tx.tenantLocale.upsert({
      where: { tenantId_locale: { tenantId, locale } }, create: { tenantId, locale, ...values }, update: values,
    })
  }
}

export async function restoreBackupContent(tx: Prisma.TransactionClient, tenantId: string, backup: WorkspaceBackup, groups: Group[]) {
  const { data } = backup
  const sourceTenantId = backup.tenant?.id
  const groupIds = new Map<string, string>()
  const collectionIds = new Map<string, string>()
  const singletonIds = new Map<string, string>()
  const references = new Map<string, string>()
  const imported = { locales: 0, contentTypeGroups: 0, contentTypes: 0, singleTypes: 0, components: 0, contentEntries: 0, singleTypeData: 0 }
  const skipped: Array<{ section: string; count: number; reason: string }> = []
  const reportSkipped = (section: string, count: number, reason: string) => {
    if (count > 0) skipped.push({ section, count, reason })
  }

  for (const group of groups) {
    const id = copyId(tenantId, sourceTenantId, group.id)
    const parentId = group.parentId ? groupIds.get(group.parentId) : null
    const values = { name: group.name, order: group.order, parentId }
    await tx.contentTypeGroup.upsert({ where: { id, tenantId }, create: { id, tenantId, ...values }, update: values })
    groupIds.set(group.id, id)
    imported.contentTypeGroups++
  }

  for (const { id, slug, groupId, fields, draftTemplateId, ...definition } of data.contentTypes) {
    if (draftTemplateId) continue
    const values = { ...definition, groupId: groupId ? groupIds.get(groupId) : groupId }
    const model = await tx.contentType.upsert({ where: { tenantId_slug: { tenantId, slug } }, create: { tenantId, slug, ...values }, update: values })
    collectionIds.set(id, model.id)
    references.set(id, model.id)
    await restoreFields(tx, { contentTypeId: model.id }, fields)
    imported.contentTypes++
  }

  for (const { id, slug, fields, draftTemplateId, ...definition } of data.singleTypes) {
    if (draftTemplateId) continue
    const model = await tx.singleType.upsert({ where: { tenantId_slug: { tenantId, slug } }, create: { tenantId, slug, ...definition }, update: definition })
    singletonIds.set(id, model.id)
    references.set(id, model.id)
    await restoreFields(tx, { singleTypeId: model.id }, fields)
    imported.singleTypes++
  }

  for (const { id, slug, fields, draftTemplateId, ...definition } of data.components) {
    if (draftTemplateId) continue
    const model = await tx.component.upsert({ where: { tenantId_slug: { tenantId, slug } }, create: { tenantId, slug, ...definition }, update: definition })
    references.set(id, model.id)
    await restoreFields(tx, { componentId: model.id }, fields)
    imported.components++
  }

  // Tenant content may use a platform model that was deliberately omitted
  // from the exported schema. Restore that content only if the destination
  // already has the same enabled platform assignment.
  const missingCollections = Array.from(new Set(data.contentEntries.map(entry => entry.contentTypeId).filter(id => !collectionIds.has(id))))
  if (missingCollections.length) {
    const assigned = await tx.contentType.findMany({
      where: { id: { in: missingCollections }, tenantId: null, draftTemplateId: null, tenants: { some: { tenantId, enabled: true } } },
      select: { id: true },
    })
    for (const { id } of assigned) collectionIds.set(id, id)
  }
  const missingSingletons = Array.from(new Set(data.singleTypeData.map(row => row.singleTypeId).filter(id => !singletonIds.has(id))))
  if (missingSingletons.length) {
    const assigned = await tx.singleType.findMany({
      where: { id: { in: missingSingletons }, tenantId: null, draftTemplateId: null, tenants: { some: { tenantId, enabled: true } } },
      select: { id: true },
    })
    for (const { id } of assigned) singletonIds.set(id, id)
  }

  const entryPlans: Array<{ row: WorkspaceBackup["data"]["contentEntries"][number]; id: string; contentTypeId: string }> = []
  for (const [index, row] of data.contentEntries.entries()) {
    const contentTypeId = collectionIds.get(row.contentTypeId)
    if (!contentTypeId) continue
    const id = row.id
      ? copyId(tenantId, sourceTenantId, row.id)
      : copyId(tenantId, undefined, `${sourceTenantId ?? ""}:${row.contentTypeId}:${row.documentId ?? index}:${row.locale}`)
    const existing = row.documentId ? await tx.contentEntry.findFirst({
      where: { tenantId, contentTypeId, documentId: row.documentId, locale: row.locale }, select: { id: true },
    }) : null
    entryPlans.push({ row, id: existing?.id ?? id, contentTypeId })
    if (row.id) references.set(row.id, existing?.id ?? id)
  }

  for (const { row, id, contentTypeId } of entryPlans) {
    const { id: sourceId, contentTypeId: sourceModelId, createdAt, updatedAt, createdBy, updatedBy, ...entry } = row
    const authors = sourceTenantId === tenantId ? { createdBy, updatedBy } : {}
    const values = { ...entry, ...authors, data: remapReferences(entry.data, references) ?? Prisma.JsonNull }
    await tx.contentEntry.upsert({
      where: { id, tenantId, contentTypeId },
      create: { id, tenantId, contentTypeId, ...values, createdAt: createdAt ?? undefined, updatedAt: updatedAt ?? undefined },
      update: { ...values, updatedAt: updatedAt ?? undefined },
    })
    imported.contentEntries++
  }

  for (const { singleTypeId: sourceModelId, locale, data: value, draftData, createdAt, updatedAt, ...record } of data.singleTypeData) {
    const singleTypeId = singletonIds.get(sourceModelId)
    if (!singleTypeId) continue
    const values = {
      ...record,
      data: value === undefined ? undefined : remapReferences(value, references) ?? Prisma.DbNull,
      draftData: draftData === undefined ? undefined : remapReferences(draftData, references) ?? Prisma.DbNull,
    }
    await tx.tenantSingleTypeAssignment.upsert({
      where: { tenantId_singleTypeId_locale: { tenantId, singleTypeId, locale } },
      create: { tenantId, singleTypeId, locale, ...values, createdAt: createdAt ?? undefined, updatedAt: updatedAt ?? undefined },
      update: { ...values, updatedAt: updatedAt ?? undefined },
    })
    imported.singleTypeData++
  }

  reportSkipped("draftTemplateSchemas", data.contentTypes.length + data.singleTypes.length + data.components.length
    - imported.contentTypes - imported.singleTypes - imported.components, "Skema draf template tidak dipulihkan sebagai skema aktif.")
  reportSkipped("contentTypeGroupAssignments", data.contentTypes.filter(model => !model.draftTemplateId && model.groupId && !groupIds.has(model.groupId)).length,
    "Penetapan grup tidak dipulihkan karena definisi grupnya tidak ada dalam cadangan.")
  reportSkipped("contentEntries", data.contentEntries.length - imported.contentEntries, "Koleksi asal tidak tersedia di workspace tujuan.")
  reportSkipped("singleTypeData", data.singleTypeData.length - imported.singleTypeData, "Single Type asal tidak tersedia di workspace tujuan.")
  reportSkipped("media", data.media.length, BACKUP_UNSUPPORTED.media)
  reportSkipped("mediaFolders", data.mediaFolders.length, BACKUP_UNSUPPORTED.mediaFolders)
  return { imported, skipped }
}
