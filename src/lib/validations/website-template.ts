import { z } from "zod/v4"

/**
 * Shared shape for a WebsiteTemplate's `files` JSON blob (prisma/schema.prisma
 * WebsiteTemplate.files) — a frontend source bundle built by SaCMS's own IT
 * team to match a specific SchemaTemplate's structure. Used by both the
 * dashboard REST routes (src/app/api/tenant/[tenant]/website-templates) and
 * the SaCMS Global "Schema Template" MCP server (src/app/api/mcp/global-schema),
 * so the validation rules only live in one place.
 *
 * Text/code source files only — no binary assets in v1 (JSON can't hold
 * them sensibly, and the frontend-env deploy pipeline this feeds into
 * already expects plain-text file content, see deployToVercel's
 * VercelDeploymentFile encoding).
 */

export const websiteTemplateFileSchema = z.object({
  path: z.string().trim().min(1).max(300),
  content: z.string().max(200_000), // ~200KB per file
})

export const websiteTemplateFilesSchema = z.array(websiteTemplateFileSchema).min(1).max(200)

export const createWebsiteTemplateSchema = z.object({
  schemaTemplateId: z.string().min(1, "schemaTemplateId wajib diisi"),
  name: z.string().trim().min(1, "Nama template wajib diisi").max(150),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  files: websiteTemplateFilesSchema,
  published: z.boolean().optional(),
})

export const updateWebsiteTemplateSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  icon: z.string().trim().max(10).optional(),
  description: z.string().trim().max(500).optional(),
  files: websiteTemplateFilesSchema.optional(),
  published: z.boolean().optional(),
})
