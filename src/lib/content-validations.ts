import { z } from "zod"

interface Field {
  slug: string
  type: string
  required: boolean
  name: string
  options?: any
}

/**
 * Generates a dynamic Zod schema based on Content Type fields
 */
export function generateContentSchema(fields: Field[]) {
  const schemaShape: Record<string, z.ZodTypeAny> = {}

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny

    switch (field.type) {
      case "text":
      case "textarea":
      case "richText":
      case "select":
        fieldSchema = z.string()
        if (field.type === "text") fieldSchema = (fieldSchema as z.ZodString).max(255)
        break

      case "email":
        fieldSchema = z.string().email({ message: `Invalid email format in ${field.name}` })
        break

      case "number":
      case "integer":
        fieldSchema = z.number({ 
          invalid_type_error: `${field.name} must be a number` 
        })
        break

      case "boolean":
        fieldSchema = z.boolean()
        break

      case "date":
      case "datetime":
        fieldSchema = z.string().or(z.date()) // Accepts string ISO or Date object
        break

      case "json":
        fieldSchema = z.any()
        break

      default:
        fieldSchema = z.any()
    }

    // Handle requirement
    if (field.required) {
      if (field.type === "text" || field.type === "textarea" || field.type === "richText") {
        fieldSchema = (fieldSchema as z.ZodString).min(1, { message: `${field.name} is required` })
      } else if (field.type === "number" || field.type === "integer") {
        fieldSchema = z.number({ 
          required_error: `${field.name} is required`,
          invalid_type_error: `${field.name} must be a number` 
        })
      } else if (field.type === "boolean") {
        fieldSchema = z.boolean({ required_error: `${field.name} is required` })
      } else {
        fieldSchema = fieldSchema.refine((val) => val !== null && val !== undefined && val !== "", {
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
export async function validateContentEntry(fields: Field[], data: any) {
  const schema = generateContentSchema(fields)
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
