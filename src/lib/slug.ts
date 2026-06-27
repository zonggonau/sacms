import { PrismaClient } from "@prisma/client"
import { db } from "./database"

/**
 * Generates a URL-friendly slug from a string
 */
export function slugify(text: string): string {
  if (!text) return ""
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, "") // Trim - from end of text
}

/**
 * Generates a unique slug for a content entry
 */
export async function generateUniqueContentSlug(
  tenantId: string | null,
  contentTypeId: string,
  fieldSlug: string,
  baseValue: string,
  entryId?: string,
  prisma: PrismaClient = db
): Promise<string> {
  const baseSlug = slugify(baseValue) || "slug"
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await (prisma as any).contentEntry.findFirst({
      where: {
        tenantId,
        contentTypeId,
        id: entryId ? { not: entryId } : undefined,
        data: {
          path: [fieldSlug],
          equals: slug,
        },
      },
    })

    if (!existing) {
      return slug
    }

    const randomSuffix = Math.floor(Math.random() * 10000)
    slug = `${baseSlug}-${randomSuffix}`
    
    if (counter > 10) {
      slug = `${baseSlug}-${Date.now()}`
      break
    }
    counter++
  }

  return slug
}

/**
 * Generates a unique slug for a single type assignment
 */
export async function generateUniqueSingleTypeSlug(
  tenantId: string | null,
  singleTypeId: string,
  fieldSlug: string,
  baseValue: string,
  assignmentId?: string,
  prisma: PrismaClient = db
): Promise<string> {
  const baseSlug = slugify(baseValue) || "slug"
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existing = await (prisma as any).tenantSingleTypeAssignment.findFirst({
      where: {
        tenantId,
        singleTypeId,
        id: assignmentId ? { not: assignmentId } : undefined,
        data: {
          path: [fieldSlug],
          equals: slug,
        },
      },
    })

    if (!existing) {
      return slug
    }

    const randomSuffix = Math.floor(Math.random() * 10000)
    slug = `${baseSlug}-${randomSuffix}`
    
    if (counter > 10) {
      slug = `${baseSlug}-${Date.now()}`
      break
    }
    counter++
  }

  return slug
}

/**
 * Processes all auto-generate slug fields in an entry
 */
export async function processAutoSlugs(
  tenantId: string | null,
  typeId: string,
  fields: any[],
  data: Record<string, any>,
  entityId?: string,
  mode: 'content' | 'single' = 'content',
  prisma: PrismaClient = db
): Promise<Record<string, any>> {
  const updatedData = { ...data }
  
  for (const field of fields) {
    if (field.type === "slug") {
      let options: any = {}
      try {
        options = typeof field.options === "string" ? JSON.parse(field.options) : (field.options || {})
      } catch (e) {}

      if (options.autoGenerate && options.sourceField) {
        const sourceValue = data[options.sourceField]
        const currentSlug = data[field.slug]
        
        if (!currentSlug && sourceValue) {
          if (mode === 'content') {
            updatedData[field.slug] = await generateUniqueContentSlug(
              tenantId,
              typeId,
              field.slug,
              sourceValue,
              entityId,
              prisma
            )
          } else {
            updatedData[field.slug] = await generateUniqueSingleTypeSlug(
              tenantId,
              typeId,
              field.slug,
              sourceValue,
              entityId,
              prisma
            )
          }
        }
      }
    }
  }
  
  return updatedData
}
