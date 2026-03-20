import { z } from "zod/v4"

// Shared field definition schema
const fieldDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1),
  required: z.boolean().optional(),
  unique: z.boolean().optional(),
  defaultValue: z.any().optional(),
  options: z.any().optional(),
  validation: z.any().optional(),
  localizable: z.boolean().optional(),
  description: z.string().max(500).optional(),
}).passthrough()

// Content Type
export const createContentTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().max(500).optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
})

export const updateContentTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  description: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
}).passthrough()

// Component
export const createComponentSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
})

export const updateComponentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
}).passthrough()

// Single Type
export const createSingleTypeSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/),
  description: z.string().max(500).optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
})

export const updateSingleTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9-]*$/).optional(),
  description: z.string().max(500).optional(),
  fields: z.array(fieldDefinitionSchema).optional(),
}).passthrough()

// User
export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["super_admin", "admin", "user"]).optional(),
  password: z.string().min(8).max(128).optional(),
})

// RBAC
export const assignRolePermissionSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
  granted: z.boolean(),
})

export const createPermissionSchema = z.object({
  name: z.string().min(1).max(100),
  displayName: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
})

// Admin settings
export const adminSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()),
}).passthrough()

// Admin API token
export const adminCreateApiTokenSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tenantId: z.string().min(1),
  type: z.enum(["read-only", "full-access"]).optional().default("read-only"),
  permissions: z.array(z.string()).optional(),
  expiresInDays: z.number().int().positive().max(365).optional(),
})
