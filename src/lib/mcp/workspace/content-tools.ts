// registerContentTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { getTenantDb } from "@/lib/database"
import { createContentEntry, updateContentEntry, deleteContentEntry, contentRevalidatePaths } from "@/lib/content/entry-service"
import { revalidatePath } from "next/cache"
import { queryContentForTenant, buildRenderHints } from "@/lib/cms-introspection"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, mcpEntryContext } from "./context"

export function registerContentTools(server: McpServer) {
    // ── query_content ────────────────────────────────────────────────────────
    server.registerTool(
      "query_content",
      {
        title: "Query Content Entries",
        description: "Fetch published or draft content entries from a Content Type collection with pagination, search, locale filtering, and sorting.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
          limit: z.number().default(10).describe("Number of items to return (max 100)"),
          page: z.number().default(1).describe("Page number (1-indexed)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"]).default("PUBLISHED"),
          search: z.string().optional().describe("Search term"),
          locale: z.string().optional().describe("Filter by locale code (e.g. 'id', 'en')"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
        },
      },
      async ({ contentTypeSlug, limit, page, status, search, locale, sortOrder }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await queryContentForTenant(tenantDb, auth.tenantId, {
          contentTypeSlug, limit, page, status, search, locale, sortOrder,
        })
        if (!result) return { content: [{ type: "text" as const, text: `❌ Content Type '${contentTypeSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content Type not found." }, isError: true }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_content_entry ────────────────────────────────────────────────────
    server.registerTool(
      "get_content_entry",
      {
        title: "Get Content Entry",
        description: "Fetch a specific content entry record by its unique ID, including all JSON fields, locale, status, and metadata.",
        inputSchema: {
          id: z.string().describe("Unique ID of the content entry (e.g. 'cmtcsh...')"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const entry = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: {
            contentType: {
              select: { id: true, name: true, slug: true, schemaFields: true }
            }
          }
        })
        if (!entry) {
          return {
            content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "Content entry not found." },
            isError: true,
          }
        }

        const renderHints = buildRenderHints(entry.contentType.schemaFields)
        const result = {
          _id: entry.id,
          _contentType: entry.contentType.slug,
          _contentTypeName: entry.contentType.name,
          _status: entry.status,
          _locale: entry.locale,
          _createdAt: entry.createdAt,
          _updatedAt: entry.updatedAt,
          _publishedAt: entry.publishedAt,
          ...(renderHints ? { _renderHints: renderHints } : {}),
          ...(typeof entry.data === "object" && entry.data !== null ? entry.data : {}),
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "create_content_entry",
      {
        title: "Create Content Entry",
        description: "Insert a new content entry record into a Content Type collection with JSON payload data. Several field types need a composite value shape (e.g. dateRange, phone, seo, code, button, location, rating) rather than a plain string/number — call list_field_types once and check each field's `entryValueShape` instead of guessing one.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the target Content Type (e.g. 'articles')"),
          data: z.record(z.string(), z.any()).describe("JSON object containing the field values (e.g. { title: 'Hello', slug: 'hello', content: '...' })"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW"]).default("PUBLISHED").describe("Initial entry status"),
          locale: z.string().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ contentTypeSlug, data, status, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)

        const result = await createContentEntry(ctx, actor, {
          contentTypeSlug,
          data: data || {},
          status,
          locale,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, contentTypeSlug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry created successfully in '${contentTypeSlug}' with ID '${result.data.id}'.\n\n${JSON.stringify(result.data, null, 2)}`
          }]
        }
      }
    )

    // ── update_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "update_content_entry",
      {
        title: "Update Content Entry",
        description: "Update an existing content entry record by its ID.",
        inputSchema: {
          id: z.string().describe("ID of the content entry to update"),
          data: z.record(z.string(), z.any()).optional().describe("Updated JSON field values (will be merged with existing data)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED"]).optional().describe("Updated status"),
        },
      },
      async ({ id, data, status }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: { contentType: { select: { slug: true } } },
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content entry not found." }, isError: true }

        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)
        const result = await updateContentEntry(ctx, actor, {
          contentTypeSlug: existing.contentType.slug,
          entryId: id,
          data,
          status,
          locale: existing.locale,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, existing.contentType.slug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry '${id}' updated successfully.\n\n${JSON.stringify(result.data, null, 2)}`
          }]
        }
      }
    )

    // ── delete_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "delete_content_entry",
      {
        title: "Delete Content Entry",
        description: "Delete a specific content entry by its ID.",
        inputSchema: {
          id: z.string().describe("ID of the content entry to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId, deletedAt: null },
          include: { contentType: { select: { slug: true } } },
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content entry not found." }, isError: true }

        const { ctx, actor } = await mcpEntryContext(auth, tenantDb)
        const result = await deleteContentEntry(ctx, actor, {
          contentTypeSlug: existing.contentType.slug,
          entryId: id,
        })
        if (!result.ok) {
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], isError: true }
        }

        for (const path of contentRevalidatePaths(auth.tenantSlug, existing.contentType.slug)) revalidatePath(path)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry '${id}' deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 4. SINGLE TYPES (SINGLETON PAGES) CRUD
    // =========================================================================
}
