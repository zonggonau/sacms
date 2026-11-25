import { z } from "zod/v4"

/**
 * Shared shape for a WebsiteTemplate's `files` JSON blob (prisma/schema.prisma
 * WebsiteTemplate.files) — a frontend source bundle built by SaCMS's own IT
 * team to match a specific SchemaTemplate's structure. Used by both the
 * dashboard REST routes (src/app/api/tenant/[tenant]/website-templates) and
 * the SaCMS Global "Schema Template" MCP server (src/app/api/mcp/global-schema),
 * so the validation rules only live in one place.
 *
 * Source files are plain text. Binary assets (logo, favicon, fonts, ...)
 * travel base64-encoded with `encoding: "base64"` — allowed ONLY for the
 * binary asset extensions below, so source code can never be smuggled past
 * review as base64, and capped per file and per bundle because the whole
 * bundle lives in one JSON column and rides inside a single MCP call.
 * deployToVercel's VercelDeploymentFile passes the encoding straight on.
 */

export const BINARY_ASSET_EXTENSIONS = [
  "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "bmp",
  "woff", "woff2", "ttf", "otf", "eot",
  "pdf", "mp3", "mp4", "webm", "wav",
] as const

export const MAX_TEXT_FILE_CHARS = 200_000
export const MAX_BINARY_FILE_BYTES = 1_000_000
export const MAX_BINARY_BUNDLE_BYTES = 5_000_000

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

export type WebsiteTemplateFileEncoding = "utf-8" | "base64"

/** Decoded size of a bundle file, without needing Buffer (this module is
 *  shared with code that may run outside Node). */
export function bundleFileBytes(file: { content: string; encoding?: WebsiteTemplateFileEncoding }): number {
  if (file.encoding !== "base64") return new TextEncoder().encode(file.content).length
  const padding = file.content.endsWith("==") ? 2 : file.content.endsWith("=") ? 1 : 0
  return Math.floor((file.content.length * 3) / 4) - padding
}

function extensionOf(path: string) {
  const name = path.slice(path.lastIndexOf("/") + 1)
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}

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
  // Outer cap is the base64 size of the largest binary asset; plain text is
  // held to MAX_TEXT_FILE_CHARS below.
  content: z.string().max(Math.ceil(MAX_BINARY_FILE_BYTES / 3) * 4),
  encoding: z.enum(["utf-8", "base64"]).optional(),
}).superRefine((file, ctx) => {
  if (file.encoding !== "base64") {
    if (file.content.length > MAX_TEXT_FILE_CHARS) {
      ctx.addIssue({ code: "custom", path: ["content"], message: `Text file is over ${MAX_TEXT_FILE_CHARS / 1000}KB.` })
    }
    return
  }
  const ext = extensionOf(file.path)
  if (!(BINARY_ASSET_EXTENSIONS as readonly string[]).includes(ext)) {
    ctx.addIssue({
      code: "custom",
      path: ["encoding"],
      message: `encoding "base64" is only for binary assets (${BINARY_ASSET_EXTENSIONS.join(", ")}). Send '${file.path}' as plain text.`,
    })
    return
  }
  if (file.content.length % 4 !== 0 || !BASE64_RE.test(file.content)) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "Not valid base64 (standard alphabet, padded, no whitespace or data: prefix)." })
    return
  }
  if (bundleFileBytes(file) > MAX_BINARY_FILE_BYTES) {
    ctx.addIssue({ code: "custom", path: ["content"], message: `Binary asset is over ${MAX_BINARY_FILE_BYTES / 1_000_000}MB — compress or resize it.` })
  }
})

export type WebsiteTemplateFile = z.infer<typeof websiteTemplateFileSchema>

export const websiteTemplateFilesSchema = z.array(websiteTemplateFileSchema).min(1).max(200).superRefine((files, ctx) => {
  const binaryBytes = files.reduce((sum, f) => sum + (f.encoding === "base64" ? bundleFileBytes(f) : 0), 0)
  if (binaryBytes > MAX_BINARY_BUNDLE_BYTES) {
    ctx.addIssue({
      code: "custom",
      path: [],
      message: `Binary assets total ${(binaryBytes / 1_000_000).toFixed(1)}MB — the bundle allows ${MAX_BINARY_BUNDLE_BYTES / 1_000_000}MB. Host large media in the workspace's Media Library instead.`,
    })
  }
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
  // One-time IDR price for Starter/Pro workspaces; null = not for sale.
  price: z.number().int().min(1000).max(100_000_000).nullable().optional(),
})
