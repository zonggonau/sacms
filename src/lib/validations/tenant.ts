import { z } from "zod/v4"
import { slugSchema } from "./common.ts"

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

// Add locale
export const addLocaleSchema = z.object({
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/),
  name: z.string().min(1).max(100),
  isDefault: z.boolean().optional().default(false),
})

// Invite member
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]),
})
