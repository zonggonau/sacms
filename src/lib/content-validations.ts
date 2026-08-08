import { z } from "zod"

interface FieldDefinition {
  slug: string
  type: string
  required: boolean
  name: string
  options?: any
}

/**
 * Generates a dynamic Zod schema based on Content Type fields
 */
export function generateContentSchema(
  fields: FieldDefinition[],
  options: { enforceRequired?: boolean } = {}
) {
  const enforceRequired = options.enforceRequired ?? true
  const schemaShape: Record<string, z.ZodTypeAny> = {}

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny
    const isRequired = enforceRequired && field.required

    const requiredParams: any = isRequired ? { required_error: `${field.name} is required` } : {}

    switch (field.type) {
      case "text":
      case "textarea":
      case "richText":
      case "select":
      case "slug":
      case "uid":
      case "url":
      case "phone":
        fieldSchema = z.string(requiredParams)
        if (field.type === "text") fieldSchema = (fieldSchema as z.ZodString).max(255)
        if (isRequired) {
          fieldSchema = (fieldSchema as z.ZodString).min(1, { message: `${field.name} is required` })
        }
        break

      case "email":
        fieldSchema = z.string(requiredParams).email({ message: `Invalid email format in ${field.name}` })
        if (isRequired) {
          fieldSchema = (fieldSchema as z.ZodString).min(1, { message: `${field.name} is required` })
        }
        break

      case "number":
      case "integer":
      case "currency":
      case "rating":
        fieldSchema = z.preprocess(
          (val) => (val === "" || val === null || val === undefined ? undefined : Number(val)),
          isRequired
            ? z.number({ required_error: `${field.name} is required`, invalid_type_error: `${field.name} must be a number` })
            : z.number({ invalid_type_error: `${field.name} must be a number` }).optional().nullable()
        )
        break

      case "boolean":
        fieldSchema = z.boolean(requiredParams)
        break

      case "date":
      case "datetime":
      case "dateRange":
        fieldSchema = z.preprocess(
          (val) => (val === "" ? undefined : val),
          isRequired
            ? z.string({ required_error: `${field.name} is required` }).or(z.date())
            : z.string().or(z.date()).optional().nullable()
        )
        break

      case "json":
      case "relation":
      case "component":
      case "media":
      case "mediaMultiple":
      case "tags":
      case "file":
      case "repeater":
      case "multiselect":
      case "button":
        fieldSchema = z.any()
        break

      default:
        fieldSchema = z.any()
    }

    // Post-processing for requirement
    if (isRequired) {
      const basicTypes = ["text", "textarea", "richText", "select", "slug", "uid", "url", "phone", "email", "number", "integer", "currency", "rating", "boolean", "date", "datetime"]

      if (!basicTypes.includes(field.type)) {
        // For non-basic types (JSON, relations, etc.), check for null/undefined/empty
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
    } else {
      if (!["number", "integer", "currency", "rating", "date", "datetime"].includes(field.type)) {
        fieldSchema = fieldSchema.optional().nullable()
      }
    }

    schemaShape[field.slug] = fieldSchema
  })

  return z.object(schemaShape)
}

/**
 * Validates entry data against content type fields
 */
export async function validateContentEntry(
  fields: FieldDefinition[],
  data: unknown,
  options: { enforceRequired?: boolean } = {}
) {
  const schema = generateContentSchema(fields, options)
  try {
    const validatedData = await schema.parseAsync(data)
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
