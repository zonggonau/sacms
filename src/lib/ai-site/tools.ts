import "server-only"

import { tool } from "ai"
import { z } from "zod"
import type { PrismaClient } from "../../../prisma/generated-client"
import { deleteProjectFiles, listProjectFiles, readProjectFile, writeProjectFiles } from "./files"
import { normalizeProjectPath } from "./paths"
import { runSandboxCommand } from "./sandbox"
import {
  getFullSchemaForTenant,
  listContentTypesForTenant,
  getContentTypeForTenant,
  queryContentForTenant,
  listComponentsForTenant,
} from "@/lib/cms-introspection"
import { cmsBuilderTools } from "./cms-tools"
import { contentEntryTools } from "./content-entry-tools"

const MAX_FILE_LENGTH = 200_000
const READ_LIMIT = 60_000

/** Commands the agent may run in the sandbox. The sandbox is isolated; this keeps runs purposeful. */
const ALLOWED_COMMANDS = ["npm", "npx", "node", "ls", "cat", "grep"] as const

const queryContentInputSchema = z.object({
  contentTypeSlug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
  limit: z.number().default(10).describe("Number of items to return (max 100)"),
  page: z.number().default(1).describe("Page number (1-indexed)"),
  status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"]).default("PUBLISHED"),
  locale: z.string().default("").describe("Filter by locale code (e.g. 'id', 'en'); empty = no filter"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

interface ToolContext {
  tenantDb: PrismaClient
  tenantId: string
  tenantSlug: string
  tenantName: string
  projectId: string
  userId: string
  role: string
}

/** Tools that let the agent read and change a project's website, plus introspect this tenant's CMS schema/content. */
export function aiSiteTools({ tenantDb, tenantId, tenantSlug, tenantName, projectId, userId, role }: ToolContext) {
  return {
    listFiles: tool({
      description: "List every file in the website project with its size in characters.",
      inputSchema: z.object({}),
      execute: async () => {
        const files = await listProjectFiles(tenantDb, projectId)
        return files.map((file) => ({ path: file.path, size: file.content.length }))
      },
    }),

    readFile: tool({
      description: "Read one file of the website project.",
      inputSchema: z.object({ path: z.string().describe("Path relative to the app root.") }),
      execute: async ({ path }) => {
        const normalized = normalizeProjectPath(path)
        if (!normalized) return { error: `Invalid path: ${path}` }
        const content = await readProjectFile(tenantDb, projectId, normalized)
        if (content === undefined) return { error: `File not found: ${normalized}` }
        return {
          path: normalized,
          content: content.length > READ_LIMIT ? `${content.slice(0, READ_LIMIT)}\n…(truncated)` : content,
        }
      },
    }),

    writeFiles: tool({
      description:
        "Create or overwrite files. Always send the complete file content, never a diff or a placeholder.",
      inputSchema: z.object({
        files: z
          .array(
            z.object({
              path: z.string().describe("Path relative to the app root, e.g. app/page.tsx."),
              content: z.string().describe("The complete file content."),
            }),
          )
          .min(1)
          .max(40),
      }),
      execute: async ({ files }) => {
        const valid: { path: string; content: string }[] = []
        const rejected: string[] = []
        for (const file of files) {
          const path = normalizeProjectPath(file.path)
          if (!path || file.content.length > MAX_FILE_LENGTH) rejected.push(file.path)
          else valid.push({ path, content: file.content })
        }
        await writeProjectFiles(tenantDb, projectId, valid)
        return { written: valid.map((file) => file.path), rejected }
      },
    }),

    deleteFiles: tool({
      description: "Delete files from the website project.",
      inputSchema: z.object({ paths: z.array(z.string()).min(1).max(40) }),
      execute: async ({ paths }) => {
        const valid = paths.map(normalizeProjectPath).filter((path): path is string => !!path)
        await deleteProjectFiles(tenantDb, projectId, valid)
        return { deleted: valid }
      },
    }),

    runCommand: tool({
      description:
        "Run a command in the app directory of the sandbox after syncing the latest files, e.g. `npm run build` to check for errors or `npm install <pkg>` (then also add it to package.json). Long-running servers are managed for you; do not start `npm run dev`.",
      inputSchema: z.object({
        command: z.enum(ALLOWED_COMMANDS),
        args: z.array(z.string()).max(30).default([]),
      }),
      execute: async ({ command, args }) => {
        if (command === "npm" && ["dev", "start"].includes(args.at(-1) ?? "")) {
          return { error: "The preview server is managed automatically." }
        }
        // .env.local (written straight into the sandbox, holding the real
        // SACMS_API_KEY) isn't reachable through writeFiles/readFile
        // (normalizeProjectPath blocks it) — but unlike those, runCommand
        // has no path allowlist at all, so `cat .env.local`, `grep KEY
        // .env.local`, or even `node -e "require('fs').readFileSync(...)"`
        // would hand the real secret back as a tool result. Block any
        // argument that references it, for every command.
        if (args.some((arg) => /\.env(\.|$)/i.test(arg))) {
          return { error: "Reading .env files is not allowed." }
        }
        try {
          return await runSandboxCommand(tenantDb, tenantId, tenantSlug, projectId, command, args)
        } catch (error) {
          return { error: error instanceof Error ? error.message : "The command failed." }
        }
      },
    }),

    cms_get_full_schema: tool({
      description:
        "Get the complete SaCMS schema for this workspace — all Content Types, Single Types, and Components with their fields. Call this FIRST when the website needs to read real CMS content.",
      inputSchema: z.object({}),
      execute: async () => {
        return getFullSchemaForTenant(tenantDb, tenantId, { id: tenantId, name: tenantName, slug: tenantSlug })
      },
    }),

    cms_list_content_types: tool({
      description: "List all SaCMS Content Types (collections) with their field schemas and entry counts.",
      inputSchema: z.object({}),
      execute: async () => {
        return listContentTypesForTenant(tenantDb, tenantId)
      },
    }),

    cms_get_content_type: tool({
      description: "Get detailed field schema for a specific SaCMS Content Type by its slug or ID.",
      inputSchema: z.object({
        slug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
      }),
      execute: async ({ slug }) => {
        const result = await getContentTypeForTenant(tenantDb, tenantId, slug)
        return result ?? { error: `Content Type '${slug}' not found.` }
      },
    }),

    cms_query_content: tool({
      description:
        "Fetch published or draft content entries from a SaCMS Content Type collection with pagination, locale filtering, and sorting.",
      inputSchema: queryContentInputSchema,
      execute: async ({ contentTypeSlug, limit, page, status, locale, sortOrder }) => {
        const result = await queryContentForTenant(tenantDb, tenantId, {
          contentTypeSlug, limit, page, status, locale: locale || undefined, sortOrder,
        })
        return result ?? { error: `Content Type '${contentTypeSlug}' not found.` }
      },
    }),

    cms_list_components: tool({
      description: "List all reusable SaCMS Components (e.g. Hero Section, Feature Card) with their field schemas.",
      inputSchema: z.object({}),
      execute: async () => {
        return listComponentsForTenant(tenantDb, tenantId)
      },
    }),

    // Write-capable schema/webhook tools (create/update/delete Content
    // Types, Single Types, Components, Webhooks) — same server actions the
    // dashboard's own CRUD screens call.
    ...cmsBuilderTools({ tenantSlug, tenantId, tenantDb }),

    // Real content-entry CRUD (actual data rows, not schema) — same
    // entry-service.ts functions the dashboard's content editor and the
    // MCP server's own content-entry tools call.
    ...contentEntryTools({ tenantDb, tenantId, tenantSlug, userId, role }),
  }
}
