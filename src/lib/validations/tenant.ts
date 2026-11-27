import { z } from "zod/v4"
import { slugSchema } from "./common"

// Create tenant
export const createTenantSchema = z.object({
  name: z.string().min(2).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
})

// Update tenant
export const updateTenantSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  logo: z.string().url().optional(),
})


// Invite member
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
})
