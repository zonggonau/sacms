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

// chatgpt8.md P1: a path traversal segment or a leading "/" was never
// rejected — these files are keyed by `path` and written out verbatim by
// the Vercel deploy pipeline (deployToVercel's VercelDeploymentFile
// encoding), so an unchecked "../../.env" or "/etc/passwd"-shaped path
// would be handed straight to that call instead of failing validation
// here, where an agent/reviewer can actually see why it was rejected.
const SAFE_RELATIVE_PATH_RE = /^(?!\/)(?!.*\.\.(\/|$))[^\0]+$/

export const websiteTemplateFileSchema = z.object({
  path: z.string().trim().min(1).max(300).refine(
    (p) => SAFE_RELATIVE_PATH_RE.test(p),
    { message: "path must be a relative path with no '..' segment and no leading '/'." },
  ),
  content: z.string().max(200_000), // ~200KB per file
})

export const websiteTemplateFilesSchema = z.array(websiteTemplateFileSchema).min(1).max(200).superRefine((files, ctx) => {
  const seen = new Map<string, number>()
  files.forEach((f, i) => {
    const firstIndex = seen.get(f.path)
    if (firstIndex !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: [i, "path"],
        message: `Duplicate file path '${f.path}' — already used at files[${firstIndex}]. Each path must be unique within the bundle.`,
      })
    } else {
      seen.set(f.path, i)
    }
  })
})

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
