import { z } from "zod/v4"

export const createApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["read-only", "full-access", "custom"]).default("read-only"),
  permissions: z.array(z.string()).optional(),
  expiresAt: z.coerce.date().optional(),
})

export const updateApiTokenSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: z.enum(["read-only", "full-access", "custom"]).optional(),
  permissions: z.array(z.string()).optional(),
})

export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>
