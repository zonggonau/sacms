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

    const requiredParams = isRequired ? { required_error: `${field.name} is required` } : {}

    switch (field.type) {
      case "text":
      case "textarea":
      case "richText":
      case "select":
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
        fieldSchema = z.number({ 
          ...requiredParams,
          invalid_type_error: `${field.name} must be a number` 
        })
        break

      case "boolean":
        fieldSchema = z.boolean(requiredParams)
        break

      case "date":
      case "datetime":
        fieldSchema = z.string(requiredParams).or(z.date(requiredParams)) // Accepts string ISO or Date object
        break

      case "json":
      case "relation":
      case "component":
      case "media":
      case "mediaMultiple":
      case "tags":
      case "file":
        fieldSchema = z.any()
        break

      default:
        fieldSchema = z.any()
    }

    // Post-processing for requirement
    if (isRequired) {
      const basicTypes = ["text", "textarea", "richText", "select", "email", "number", "integer", "boolean"]
      const jsonTypes = ["json", "relation", "component", "media", "mediaMultiple", "tags", "file"]

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
      fieldSchema = fieldSchema.optional().nullable()
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
