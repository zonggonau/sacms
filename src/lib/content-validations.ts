import { z } from "zod"
import { isFieldVisible } from "@/lib/field-visibility"

interface FieldDefinition {
  slug: string
  type: string
  required: boolean
  name: string
  options?: any
}

/**
 * Generates a dynamic Zod schema based on Content Type fields.
 *
 * `data` (the submitted payload) is optional but should be passed whenever
 * available: a field hidden by conditional visibility (options.showIf)
 * never got a chance to be filled in, so requiring it here would make the
 * entry permanently unsavable whenever its showIf condition isn't met.
 */
export function generateContentSchema(
  fields: FieldDefinition[],
  options: { enforceRequired?: boolean; data?: Record<string, unknown> } = {}
) {
  const enforceRequired = options.enforceRequired ?? true
  const data = options.data ?? {}
  const schemaShape: Record<string, z.ZodTypeAny> = {}

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny
    const isRequired = enforceRequired && field.required && isFieldVisible(field, data)
    const requiredParams = isRequired ? { message: `${field.name} is required` } : undefined

    switch (field.type) {
      case "text":
      case "textarea":
      case "richText":
      case "richtext":
      case "select":
      case "slug":
      case "uid":
      case "url":
      case "icon":
        fieldSchema = z.preprocess(
          (val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
          isRequired
            ? z.string(requiredParams).min(1, { message: `${field.name} is required` })
            : z.string().optional().nullable()
        )
        break

      case "phone":
        fieldSchema = z.preprocess(
          (val) => {
            if (val === "" || val === null || val === undefined) return undefined
            return val
          },
          z.union([
            z.string(),
            z.number(),
            z.record(z.string(), z.any()),
          ]).optional().nullable()
        )
        if (isRequired) {
          fieldSchema = fieldSchema.refine((val) => {
            if (!val) return false
            if (typeof val === "string") return val.trim().length > 0
            if (typeof val === "number") return true
            if (typeof val === "object" && val !== null) {
              const num = (val as any).number ?? (val as any).phone
              return num !== undefined && num !== null && String(num).trim().length > 0
            }
            return true
          }, { message: `${field.name} is required` })
        }
        break

      case "email":
        fieldSchema = z.preprocess(
          (val) => (val === "" || val === null || val === undefined ? undefined : String(val)),
          isRequired
            ? z.string(requiredParams).email({ message: `Invalid email format in ${field.name}` })
            : z.string().email().optional().nullable()
        )
        break

      case "number":
      case "integer":
      case "currency":
      case "rating":
      case "percent":
        fieldSchema = z.preprocess(
          (val) => {
            if (val === "" || val === null || val === undefined) return undefined
            const n = Number(val)
            return isNaN(n) ? val : n
          },
          isRequired
            ? z.number({ message: `${field.name} must be a number` })
            : z.number({ message: `${field.name} must be a number` }).optional().nullable()
        )
        break

      case "boolean":
        fieldSchema = z.preprocess(
          (val) => (val === "" || val === null || val === undefined ? undefined : Boolean(val)),
          isRequired ? z.boolean(requiredParams) : z.boolean().optional().nullable()
        )
        break

      case "date":
      case "datetime":
      case "dateRange":
      case "daterange":
        fieldSchema = z.preprocess(
          (val) => (val === "" || val === null || val === undefined ? undefined : val),
          isRequired
            ? z.string(requiredParams).or(z.date()).or(z.record(z.string(), z.any()))
            : z.string().or(z.date()).or(z.record(z.string(), z.any())).optional().nullable()
        )
        break

      case "document_template":
        fieldSchema = z.any().optional().nullable()
        break

      case "json":
      case "relation":
      case "component":
      case "media":
      case "mediaMultiple":
      case "media_multiple":
      case "tags":
      case "file":
      case "repeater":
      case "multiselect":
      case "button":
      case "location":
      case "seo":
      case "code":
        fieldSchema = z.any().optional().nullable()
        if (isRequired) {
          fieldSchema = fieldSchema.refine((val) => {
            if (val === null || val === undefined) return false
            if (typeof val === 'string' && val.trim() === "") return false
            if (Array.isArray(val) && val.length === 0) return false
            if (typeof val === 'object' && Object.keys(val).length === 0 && !(val instanceof Date)) return false
            return true
          }, {
            message: `${field.name} is required`,
          })
        }
        break

      default:
        fieldSchema = z.any().optional().nullable()
    }

    if (!isRequired) {
      fieldSchema = fieldSchema.optional().nullable()
    }

    schemaShape[field.slug] = fieldSchema
  })

  return z.object(schemaShape).passthrough()
}

/**
 * Validates entry data against content type fields
 */
export async function validateContentEntry(
  fields: FieldDefinition[],
  data: unknown,
  options: { enforceRequired?: boolean } = {}
) {
  const dataObj = (data && typeof data === "object" && !Array.isArray(data)) ? (data as Record<string, unknown>) : {}
  const schema = generateContentSchema(fields, { ...options, data: dataObj })
  try {
    const validatedData = await schema.parseAsync(data || {})
    return { success: true, data: validatedData, errors: null }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors: Record<string, string> = {}
      error.issues.forEach((issue) => {
        const path = issue.path[0] as string
        if (path) {
          formattedErrors[path] = issue.message
        }
      })
      return { success: false, data: null, errors: formattedErrors }
    }
    return { success: false, data: null, errors: { _global: "Validation failed" } }
  }
}
