import { z } from "zod/v4"

export const updateMemberRoleSchema = z.object({
  role: z.enum(["owner", "admin", "editor", "viewer"]),
})

export const updateTenantSettingsSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  apiVersion: z.string().max(20).optional(),
  rateLimiting: z.boolean().optional(),
  requestsPerMinute: z.number().int().min(1).max(10000).optional(),
  burstLimit: z.number().int().min(1).max(1000).optional(),
  corsOrigins: z.string().max(2000).optional(),
  twoFactorRequired: z.boolean().optional(),
  ipWhitelist: z.boolean().optional(),
  allowedIps: z.string().max(2000).optional(),
  auditLogging: z.boolean().optional(),
  databaseUrl: z.string().url().or(z.literal("")).optional(),
  storageConfig: z.object({
    endpoint: z.string().url(),
    accessKey: z.string(),
    secretKey: z.string(),
    bucket: z.string(),
    publicUrl: z.string().url().or(z.literal(""))
  }).nullable().optional(),
  smtpHost: z.string().max(200).optional(),
  smtpPort: z.string().max(10).optional(),
  smtpUser: z.string().max(200).optional(),
  smtpPassword: z.string().max(500).optional(),
  fromEmail: z.string().email().or(z.literal("")).optional(),
  fromName: z.string().max(200).optional(),
}).passthrough()

export const saveSingleTypeDataSchema = z.object({
  singleTypeId: z.string().min(1).optional(),
  data: z.record(z.string(), z.any()).optional(),
  publish: z.boolean().optional(),
})

export const createContentEntrySchema = z.object({
  data: z.record(z.string(), z.any()),
  publish: z.boolean().optional(),
  locale: z.string().optional(),
})

export const updateContentEntrySchema = z.object({
  data: z.record(z.string(), z.any()),
  publish: z.boolean().optional(),
  locale: z.string().optional(),
})

export const checkoutSchema = z.object({
  planId: z.string().min(1),
  tenantId: z.string().min(1).optional(),
  type: z.enum(["workspace", "account"]).optional().default("workspace"),
  interval: z.enum(["month", "year"]).optional().default("month"),
})

export const graphqlRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  variables: z.record(z.string(), z.any()).optional(),
  operationName: z.string().max(200).optional(),
})
