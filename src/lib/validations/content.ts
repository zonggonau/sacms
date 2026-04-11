import { z } from "zod/v4"
import { contentStatusSchema, cuidSchema } from "./common"

// Create content entry
export const createEntrySchema = z.object({
  data: z.record(z.string(), z.unknown()),
  status: contentStatusSchema.optional().default("DRAFT"),
  locale: z.string().optional().default("en"),
  scheduledAt: z.coerce.date().optional(),
})

// Update content entry
export const updateEntrySchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  status: contentStatusSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
})

// Change status
export const changeStatusSchema = z.object({
  status: contentStatusSchema,
  comment: z.string().max(1000).optional(),
  scheduledAt: z.coerce.date().optional(),
})

// Bulk delete
export const bulkDeleteSchema = z.object({
  ids: z.array(cuidSchema).min(1).max(100),
})

export type CreateEntryInput = z.infer<typeof createEntrySchema>
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>
