import { z } from "zod/v4"

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().max(2000),
  secret: z.string().max(256).optional(),
  events: z.array(z.string().min(1)).min(1),
  headers: z.record(z.string(), z.string()).optional(),
  hookType: z.enum(["async", "sync"]).default("async"),
  enabled: z.boolean().optional().default(true),
})

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().max(2000).optional(),
  secret: z.string().max(256).optional(),
  events: z.array(z.string().min(1)).min(1).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  hookType: z.enum(["async", "sync"]).optional(),
  enabled: z.boolean().optional(),
})

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>
