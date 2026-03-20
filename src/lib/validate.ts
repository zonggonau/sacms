import { NextResponse } from "next/server"
import { z } from "zod/v4"

/**
 * Parse and validate request body with a Zod schema.
 * Returns parsed data or a NextResponse error.
 */
export async function validateBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      ),
    }
  }

  const result = schema.safeParse(raw)
  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          error: "Validation failed",
          details: z.prettifyError(result.error),
        },
        { status: 400 }
      ),
    }
  }

  return { data: result.data }
}

/**
 * Parse and validate query params with a Zod schema.
 */
export function validateQuery<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): { data: z.infer<T> } | { error: NextResponse } {
  const obj: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    obj[key] = value
  })

  const result = schema.safeParse(obj)
  if (!result.success) {
    return {
      error: NextResponse.json(
        {
          error: "Invalid query parameters",
          details: z.prettifyError(result.error),
        },
        { status: 400 }
      ),
    }
  }

  return { data: result.data }
}
