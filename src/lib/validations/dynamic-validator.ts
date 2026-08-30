import { z } from "zod/v4"
import { db } from "@/lib/database"
import type { PrismaClient } from "../../../prisma/generated-client"

/**
 * Dynamic Content Validator
 * Validates JSON content data against SchemaField definitions from the DB.
 */

export interface FieldDefinition {
  name: string
  slug: string
  type: string
  required: boolean
  unique?: boolean
}

export async function validateDynamicContent(
  contentTypeId: string,
  tenantId: string,
  data: Record<string, any>,
  entryId?: string, // Pass entryId for updates to skip self-uniqueness check
  options: { enforceRequired?: boolean; client?: PrismaClient } = {}
): Promise<{ success: boolean; errors?: Record<string, string> }> {
  const enforceRequired = options.enforceRequired ?? true
  const client = options.client ?? db
  // 1. Get field definitions for this content type
  const fields = await client.schemaField.findMany({
    where: { contentTypeId },
  })

  const errors: Record<string, string> = {}

  for (const field of fields) {
    const value = data[field.slug]

    // Check Required
    if (enforceRequired && field.required) {
      if (value === undefined || value === null || value === "") {
        errors[field.slug] = `${field.name} is required`
        continue
      }
      if (typeof value === "object" && !Array.isArray(value)) {
        if (field.type === "phone" && (!value.number || String(value.number).trim() === "")) {
          errors[field.slug] = `${field.name} is required`
          continue
        }
      }
    }

    // Skip further checks if empty and not required
    if (value === undefined || value === null || value === "") continue

    // Type Validation
    switch (field.type) {
      case "number":
      case "integer":
      case "currency":
      case "rating":
      case "percent":
        if (typeof value !== "number" && (typeof value !== "string" || isNaN(Number(value)) || value.trim() === "")) {
          errors[field.slug] = `${field.name} must be a number`
        }
        break
      case "boolean":
        if (typeof value !== "boolean" && value !== "true" && value !== "false" && value !== 1 && value !== 0) {
          errors[field.slug] = `${field.name} must be a boolean`
        }
        break
      case "email":
        const emailSchema = z.string().email()
        if (typeof value !== "string" || !emailSchema.safeParse(value).success) {
          errors[field.slug] = `Invalid email format`
        }
        break
      case "date":
      case "datetime":
        if (typeof value === "string" && isNaN(Date.parse(value))) {
          errors[field.slug] = `Invalid date format`
        }
        break
      // Add more specific type checks as needed
    }

    // Uniqueness Check (if enabled)
    if (field.unique && typeof value !== "object") {
      const existing = await client.contentEntry.findFirst({
        where: {
          contentTypeId,
          tenantId,
          id: entryId ? { not: entryId } : undefined,
          data: {
            path: [field.slug],
            equals: value,
          },
        },
      })

      if (existing) {
        errors[field.slug] = `${field.name} must be unique`
      }
    }
  }

  return {
    success: Object.keys(errors).length === 0,
    errors,
  }
}
