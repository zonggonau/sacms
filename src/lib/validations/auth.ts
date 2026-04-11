import { z } from "zod/v4"
import { slugSchema } from "./common"

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  tenantName: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(2).max(100).optional()
  ),
  tenantSlug: slugSchema.optional(),
})

export type RegisterInput = z.infer<typeof registerSchema>
