/**
 * SaCMS Model Context Protocol (MCP) Server
 *
 * Full CRUD capabilities for Content Types, Single Types, Components,
 * Content Entries, and Webhooks.
 *
 * Enables AI agents (v0, Cursor, Claude Desktop, Antigravity, VS Code, Windsurf, Cline)
 * to design, build, populate, and automate dynamic websites directly through MCP.
 *
 * Auth: Standard HTTP Bearer token (Authorization: Bearer <API_TOKEN>)
 * URL:  /api/mcp
 */

import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { NextResponse } from "next/server"
import { createHash } from "crypto"
import { AsyncLocalStorage } from "async_hooks"

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthContext {
  tenantId: string
  tenantSlug: string
  tenantName: string
}

const authContext = new AsyncLocalStorage<AuthContext>()

async function resolveToken(rawToken: string): Promise<AuthContext | null> {
  if (!rawToken?.trim()) return null
  const clean = rawToken.trim()
  const hashed = createHash("sha256").update(clean).digest("hex")

  // Look up by hashed token first, then plain token
  const token = await db.apiToken.findFirst({
    where: {
      OR: [
        { token: hashed },
        { token: clean },
      ]
    },
    select: { 
      tenantId: true, 
      tenant: { select: { id: true, slug: true, name: true } } 
    },
  })

  if (token?.tenant) {
    // Update lastUsedAt asynchronously
    db.apiToken.updateMany({
      where: { OR: [{ token: hashed }, { token: clean }] },
      data: { lastUsedAt: new Date() }
    }).catch(() => {})

    return {
      tenantId: token.tenant.id,
      tenantSlug: token.tenant.slug,
      tenantName: token.tenant.name,
    }
  }

  // Also fallback to ApiKey (plain key)
  const apiKey = await db.apiKey.findUnique({
    where: { key: clean },
    include: { tenant: true },
  })

  if (apiKey?.tenant) {
    db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    }).catch(() => {})

    return {
      tenantId: apiKey.tenant.id,
      tenantSlug: apiKey.tenant.slug,
      tenantName: apiKey.tenant.name,
    }
  }

  return null
}

const UNAUTHORIZED = {
  content: [{
    type: "text" as const,
    text: "❌ Unauthorized: Invalid or missing API token. Please provide a valid Bearer token for your SaCMS workspace."
  }]
}

// ─── MCP Handler with Complete CRUD Capabilities ─────────────────────────────

const handler = createMcpHandler(
  async (server) => {

    // =========================================================================
    // 1. FULL SCHEMA & INTROSPECTION TOOLS
    // =========================================================================

    // ── get_full_schema ──────────────────────────────────────────────────────
    server.registerTool(
      "get_full_schema",
      {
        title: "Get Full Schema",
        description: "Get the complete database schema of the workspace — all Content Types (collections), Single Types (one-off pages), and Components (reusable blocks) with their fields and configurations. Call this FIRST when building or scaffolding frontend applications.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const [contentTypes, singleTypes, components] = await Promise.all([
          tenantDb.contentType.findMany({ 
            where: { tenantId: auth.tenantId }, 
            include: { schemaFields: { orderBy: { order: "asc" } } } 
          }),
          tenantDb.singleType.findMany({ 
            where: { tenantId: auth.tenantId }, 
            include: { schemaFields: { orderBy: { order: "asc" } } } 
          }),
          tenantDb.component.findMany({ 
            where: { tenantId: auth.tenantId }, 
            include: { schemaFields: { orderBy: { order: "asc" } } } 
          }),
        ])

        const mapFields = (fields: any[]) => fields.map((f) => ({
          name: f.name,
          slug: f.slug,
          type: f.type,
          required: f.required,
          unique: f.unique,
          localizable: f.localizable,
          ...(f.relationSlug ? { relationSlug: f.relationSlug } : {}),
          ...(f.options ? { options: f.options } : {}),
        }))

        const schema = {
          workspace: { id: auth.tenantId, name: auth.tenantName, slug: auth.tenantSlug },
          contentTypes: contentTypes.map((ct) => ({ 
            id: ct.id, 
            name: ct.name, 
            slug: ct.slug, 
            description: ct.description, 
            fields: mapFields(ct.schemaFields) 
          })),
          singleTypes: singleTypes.map((st) => ({ 
            id: st.id, 
            name: st.name, 
            slug: st.slug, 
            description: st.description, 
            fields: mapFields(st.schemaFields) 
          })),
          components: components.map((c) => ({ 
            id: c.id, 
            name: c.name, 
            slug: c.slug, 
            category: c.category, 
            description: c.description, 
            fields: mapFields(c.schemaFields) 
          })),
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }] }
      }
    )

    // =========================================================================
    // 2. CONTENT TYPES (COLLECTIONS) CRUD
    // =========================================================================

    // ── list_content_types ───────────────────────────────────────────────────
    server.registerTool(
      "list_content_types",
      {
        title: "List Content Types",
        description: "List all Content Types (collections like articles, products, categories, authors) with their field schemas and total entry counts.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const contentTypes = await tenantDb.contentType.findMany({
          where: { tenantId: auth.tenantId },
          include: { 
            schemaFields: { orderBy: { order: "asc" } },
            _count: { select: { entries: true } }
          },
          orderBy: { name: "asc" },
        })

        const result = contentTypes.map((ct) => ({
          id: ct.id,
          name: ct.name,
          slug: ct.slug,
          description: ct.description,
          entryCount: ct._count.entries,
          fields: ct.schemaFields.map((f) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            unique: f.unique,
            relationSlug: f.relationSlug,
            options: f.options
          })),
        }))

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_content_type ─────────────────────────────────────────────────────
    server.registerTool(
      "get_content_type",
      {
        title: "Get Content Type Schema",
        description: "Get detailed field schema and metadata for a specific Content Type by its slug or ID.",
        inputSchema: {
          slug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
        },
      },
      async ({ slug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          },
          include: { 
            schemaFields: { orderBy: { order: "asc" } },
            _count: { select: { entries: true } }
          }
        })

        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        const result = {
          id: ct.id,
          name: ct.name,
          slug: ct.slug,
          description: ct.description,
          showInCms: ct.showInCms,
          entryCount: ct._count.entries,
          fields: ct.schemaFields.map(f => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            unique: f.unique,
            localizable: f.localizable,
            relationSlug: f.relationSlug,
            options: f.options
          }))
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "create_content_type",
      {
        title: "Create Content Type",
        description: "Create a new Content Type collection schema with fields. Field types: 'string', 'text', 'richtext', 'number', 'boolean', 'date', 'media', 'relation', 'component', 'json', 'select'.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Blog Post', 'Product Item')"),
          slug: z.string().describe("URL-safe slug (e.g. 'articles', 'products')"),
          description: z.string().optional().describe("Description of this collection"),
          showInCms: z.boolean().default(true).describe("Whether to display in CMS sidebar"),
          fields: z.array(
            z.object({
              name: z.string().describe("Field display name (e.g. 'Title', 'Price')"),
              slug: z.string().describe("Field slug (e.g. 'title', 'price')"),
              type: z.string().describe("Field type: string, text, richtext, number, boolean, date, media, relation, component, json, select"),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional().describe("For relation type: slug of target content type"),
              options: z.record(z.string(), z.any()).optional().describe("Extra field options (e.g. { componentSlug: 'hero' })"),
            })
          ).optional().describe("List of field definitions to create for this Content Type"),
        },
      },
      async ({ name, slug, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-")
        const tenantDb = await getTenantDb(auth.tenantSlug)

        // Check if slug already exists
        const existing = await tenantDb.contentType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug }
        })
        if (existing) {
          return { content: [{ type: "text" as const, text: `❌ A Content Type with slug '${cleanSlug}' already exists.` }] }
        }

        const created = await tenantDb.contentType.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            description: description || null,
            showInCms: showInCms ?? true,
            isPublished: true,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: f.slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "_"),
                type: f.type,
                required: f.required || false,
                unique: f.unique || false,
                localizable: f.localizable ?? true,
                relationSlug: f.relationSlug || null,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${created.name}' (slug: '${created.slug}') created successfully with ${created.schemaFields.length} fields.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── update_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "update_content_type",
      {
        title: "Update Content Type",
        description: "Update an existing Content Type's name, description, or add/replace its schema fields.",
        inputSchema: {
          slug: z.string().describe("Current slug or ID of the Content Type to update"),
          name: z.string().optional().describe("New display name"),
          description: z.string().optional().describe("New description"),
          showInCms: z.boolean().optional().describe("Show in CMS navigation"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.string(),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional(),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided, replaces the schema field set."),
        },
      },
      async ({ slug, name, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        // Update fields if provided
        if (fields && fields.length > 0) {
          await tenantDb.schemaField.deleteMany({
            where: { contentTypeId: ct.id }
          })
          await tenantDb.schemaField.createMany({
            data: fields.map((f, idx) => ({
              contentTypeId: ct.id,
              name: f.name,
              slug: f.slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "_"),
              type: f.type,
              required: f.required || false,
              unique: f.unique || false,
              localizable: f.localizable ?? true,
              relationSlug: f.relationSlug || null,
              options: f.options || {},
              order: idx,
            }))
          })
        }

        const updated = await tenantDb.contentType.update({
          where: { id: ct.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(showInCms !== undefined ? { showInCms } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
          }]
        }
      }
    )

    // ── delete_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "delete_content_type",
      {
        title: "Delete Content Type",
        description: "Permanently delete a Content Type collection, its schema fields, and all its stored content entries.",
        inputSchema: {
          slug: z.string().describe("Slug or ID of the Content Type to delete"),
        },
      },
      async ({ slug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }] }

        await tenantDb.contentType.delete({
          where: { id: ct.id }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content Type '${ct.name}' (slug: '${ct.slug}') has been permanently deleted.`
          }]
        }
      }
    )

    // =========================================================================
    // 3. CONTENT ENTRIES CRUD (DATA ENTITIES)
    // =========================================================================

    // ── query_content ────────────────────────────────────────────────────────
    server.registerTool(
      "query_content",
      {
        title: "Query Content Entries",
        description: "Fetch published or draft content entries from a Content Type collection with pagination, search, and sorting.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the Content Type (e.g. 'articles', 'products')"),
          limit: z.number().default(10).describe("Number of items to return (max 100)"),
          page: z.number().default(1).describe("Page number (1-indexed)"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW", "ARCHIVED", "ALL"]).default("PUBLISHED"),
          search: z.string().optional().describe("Search term"),
          sortOrder: z.enum(["asc", "desc"]).default("desc"),
        },
      },
      async ({ contentTypeSlug, limit, page, status, search, sortOrder }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({ 
          where: { 
            OR: [
              { slug: contentTypeSlug, tenantId: auth.tenantId },
              { id: contentTypeSlug, tenantId: auth.tenantId },
            ]
          } 
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${contentTypeSlug}' not found.` }] }

        const safeLimit = Math.min(limit ?? 10, 100)
        const safePage = Math.max(page ?? 1, 1)

        const whereClause: any = {
          contentTypeId: ct.id,
          tenantId: auth.tenantId,
        }
        if (status && status !== "ALL") {
          whereClause.status = status
        }

        const [entries, total] = await Promise.all([
          tenantDb.contentEntry.findMany({
            where: whereClause,
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
            orderBy: { createdAt: sortOrder ?? "desc" },
          }),
          tenantDb.contentEntry.count({ where: whereClause })
        ])

        const result = {
          contentType: ct.slug,
          pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit)
          },
          data: entries.map((e) => ({
            _id: e.id,
            _status: e.status,
            _createdAt: e.createdAt,
            _publishedAt: e.publishedAt,
            ...(typeof e.data === "object" && e.data !== null ? e.data : {}),
          })),
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_entry ─────────────────────────────────────────────────
    server.registerTool(
      "create_content_entry",
      {
        title: "Create Content Entry",
        description: "Insert a new content entry record into a Content Type collection with JSON payload data.",
        inputSchema: {
          contentTypeSlug: z.string().describe("Slug of the target Content Type (e.g. 'articles')"),
          data: z.record(z.string(), z.any()).describe("JSON object containing the field values (e.g. { title: 'Hello', slug: 'hello', content: '...' })"),
          status: z.enum(["PUBLISHED", "DRAFT", "IN_REVIEW"]).default("PUBLISHED").describe("Initial entry status"),
        },
      },
      async ({ contentTypeSlug, data, status }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            OR: [
              { slug: contentTypeSlug, tenantId: auth.tenantId },
              { id: contentTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${contentTypeSlug}' not found.` }] }

        const entry = await tenantDb.contentEntry.create({
          data: {
            contentTypeId: ct.id,
            tenantId: auth.tenantId,
            data: data || {},
            status: status || "PUBLISHED",
            publishedAt: status === "PUBLISHED" ? new Date() : null,
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry created successfully in '${ct.slug}' with ID '${entry.id}'.\n\n${JSON.stringify(entry, null, 2)}`
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

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }] }

        const existingData = typeof existing.data === "object" && existing.data !== null ? existing.data : {}
        const mergedData = data ? { ...existingData, ...data } : existingData

        const updated = await tenantDb.contentEntry.update({
          where: { id },
          data: {
            data: mergedData,
            ...(status ? { status } : {}),
            ...(status === "PUBLISHED" && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Content entry '${id}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
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

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const existing = await tenantDb.contentEntry.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Content entry with ID '${id}' not found.` }] }

        await tenantDb.contentEntry.delete({ where: { id } })

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

    // ── list_single_types ────────────────────────────────────────────────────
    server.registerTool(
      "list_single_types",
      {
        title: "List Single Types",
        description: "List all Single Types (one-off page schemas like Homepage, About Page, Global Site Settings).",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const singleTypes = await tenantDb.singleType.findMany({
          where: { tenantId: auth.tenantId },
          include: { 
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId }, take: 1 }
          },
          orderBy: { name: "asc" },
        })

        const result = singleTypes.map((st) => ({
          id: st.id,
          name: st.name,
          slug: st.slug,
          description: st.description,
          hasData: !!st.tenants[0]?.data,
          fields: st.schemaFields.map((f) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            unique: f.unique,
          })),
        }))

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── get_single_type ──────────────────────────────────────────────────────
    server.registerTool(
      "get_single_type",
      {
        title: "Get Single Type Content & Schema",
        description: "Fetch the schema fields and actual saved content data for a specific Single Type.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug of the Single Type (e.g. 'homepage', 'global-settings', 'about')"),
        },
      },
      async ({ singleTypeSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          },
          include: { 
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId }, take: 1 }
          },
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        const result = {
          singleType: {
            id: st.id,
            name: st.name,
            slug: st.slug,
            description: st.description,
            fields: st.schemaFields.map(f => ({
              name: f.name,
              slug: f.slug,
              type: f.type,
              required: f.required,
              options: f.options
            })),
          },
          data: st.tenants[0]?.data || {}
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "create_single_type",
      {
        title: "Create Single Type",
        description: "Create a new Single Type (singleton page schema e.g. 'Homepage', 'Contact Page') with fields and optional initial content data.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Homepage', 'Site Settings')"),
          slug: z.string().describe("URL-friendly slug (e.g. 'homepage', 'site-settings')"),
          description: z.string().optional().describe("Description of this single type"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.string(),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("Field definitions"),
          initialData: z.record(z.string(), z.any()).optional().describe("Initial singleton content values"),
        },
      },
      async ({ name, slug, description, fields, initialData }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-")
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.singleType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug }
        })
        if (existing) return { content: [{ type: "text" as const, text: `❌ Single Type '${cleanSlug}' already exists.` }] }

        const created = await tenantDb.singleType.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            description: description || null,
            isPublished: true,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: f.slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "_"),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
                locale: "en",
                data: initialData || {},
                publishedAt: new Date()
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: true
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${created.name}' (slug: '${created.slug}') created successfully.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── update_single_type_content ───────────────────────────────────────────
    server.registerTool(
      "update_single_type_content",
      {
        title: "Update Single Type Content",
        description: "Save or update the singleton content values stored in a Single Type (e.g. hero banner title, footer links).",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug of the Single Type (e.g. 'homepage')"),
          data: z.record(z.string(), z.any()).describe("JSON object of content values"),
          locale: z.string().default("en").describe("Content locale (default 'en')"),
        },
      },
      async ({ singleTypeSlug, data, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        const assignment = await tenantDb.tenantSingleTypeAssignment.upsert({
          where: {
            tenantId_singleTypeId_locale: {
              tenantId: auth.tenantId,
              singleTypeId: st.id,
              locale: locale || "en"
            }
          },
          update: {
            data: data || {},
            publishedAt: new Date(),
          },
          create: {
            tenantId: auth.tenantId,
            singleTypeId: st.id,
            locale: locale || "en",
            data: data || {},
            publishedAt: new Date(),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${st.slug}' content saved successfully.\n\n${JSON.stringify(assignment, null, 2)}`
          }]
        }
      }
    )

    // ── delete_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "delete_single_type",
      {
        title: "Delete Single Type",
        description: "Permanently delete a Single Type, its schema fields, and its stored content data.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type to delete"),
        },
      },
      async ({ singleTypeSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }] }

        await tenantDb.singleType.delete({ where: { id: st.id } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${st.name}' (slug: '${st.slug}') deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 5. COMPONENTS (REUSABLE NESTED BLOCKS) CRUD
    // =========================================================================

    // ── list_components ──────────────────────────────────────────────────────
    server.registerTool(
      "list_components",
      {
        title: "List Components",
        description: "List all reusable Components (e.g. Hero Section, Feature Card, FAQ Item, SEO Meta block) with their field schemas.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const components = await tenantDb.component.findMany({
          where: { tenantId: auth.tenantId },
          include: { schemaFields: { orderBy: { order: "asc" } } },
          orderBy: { name: "asc" },
        })

        const result = components.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          category: c.category,
          description: c.description,
          fields: c.schemaFields.map((f) => ({
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            options: f.options
          })),
        }))

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_component ─────────────────────────────────────────────────────
    server.registerTool(
      "create_component",
      {
        title: "Create Component",
        description: "Create a new reusable Component schema definition that can be embedded inside Content Types and Single Types.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Hero Banner', 'Call To Action')"),
          slug: z.string().describe("Slug identifier (e.g. 'hero-banner', 'cta-box')"),
          category: z.string().optional().default("sections").describe("Component category (e.g. 'sections', 'elements', 'meta')"),
          description: z.string().optional().describe("Description of this component"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.string(),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("List of component field definitions"),
        },
      },
      async ({ name, slug, category, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "-")
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.component.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug }
        })
        if (existing) return { content: [{ type: "text" as const, text: `❌ Component '${cleanSlug}' already exists.` }] }

        const created = await tenantDb.component.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            slug: cleanSlug,
            category: category || "sections",
            description: description || null,
            schemaFields: {
              create: (fields || []).map((f, idx) => ({
                name: f.name,
                slug: f.slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, "_"),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
              }
            }
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${created.name}' (slug: '${created.slug}') created successfully.\n\n${JSON.stringify(created, null, 2)}`
          }]
        }
      }
    )

    // ── delete_component ─────────────────────────────────────────────────────
    server.registerTool(
      "delete_component",
      {
        title: "Delete Component",
        description: "Permanently delete a Component and its schema fields.",
        inputSchema: {
          componentSlug: z.string().describe("Slug or ID of the Component to delete"),
        },
      },
      async ({ componentSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }] }

        await tenantDb.component.delete({ where: { id: c.id } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${c.name}' (slug: '${c.slug}') deleted successfully.`
          }]
        }
      }
    )

    // =========================================================================
    // 6. WEBHOOKS CRUD & AUTOMATION
    // =========================================================================

    // ── list_webhooks ────────────────────────────────────────────────────────
    server.registerTool(
      "list_webhooks",
      {
        title: "List Webhooks",
        description: "List all configured webhooks, their subscribed events, URLs, and status.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const webhooks = await db.webhook.findMany({
          where: { tenantId: auth.tenantId },
          orderBy: { createdAt: "desc" },
        })

        const result = webhooks.map((w) => ({
          id: w.id,
          name: w.name,
          url: w.url,
          events: w.events,
          enabled: w.enabled,
          hookType: w.hookType,
          failureCount: w.failureCount,
          lastTriggeredAt: w.lastTriggeredAt,
          createdAt: w.createdAt,
        }))

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "create_webhook",
      {
        title: "Create Webhook",
        description: "Register a new webhook endpoint to receive notifications on CMS events (e.g. 'content.created', 'content.published', 'content.updated', 'content.deleted', 'media.uploaded').",
        inputSchema: {
          name: z.string().describe("Descriptive name (e.g. 'Vercel Deploy Hook', 'Discord Notification')"),
          url: z.string().url().describe("Destination endpoint URL (must start with https:// or http://)"),
          events: z.array(z.string()).describe("Array of event names (e.g. ['content.created', 'content.published', 'content.deleted'])"),
          secret: z.string().optional().describe("Optional HMAC signature secret"),
          enabled: z.boolean().default(true).describe("Whether the webhook is immediately active"),
          hookType: z.enum(["async", "sync"]).default("async").describe("Hook type ('async' background dispatch or 'sync' pre-save validation)"),
        },
      },
      async ({ name, url, events, secret, enabled, hookType }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const webhook = await db.webhook.create({
          data: {
            tenantId: auth.tenantId,
            name: name.trim(),
            url: url.trim(),
            events: events as any,
            secret: secret || null,
            enabled: enabled ?? true,
            hookType: hookType || "async",
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${webhook.name}' (ID: '${webhook.id}') created successfully targeting ${webhook.url}.\n\n${JSON.stringify(webhook, null, 2)}`
          }]
        }
      }
    )

    // ── update_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "update_webhook",
      {
        title: "Update Webhook",
        description: "Update an existing webhook configuration (name, URL, subscribed events, active state).",
        inputSchema: {
          id: z.string().describe("ID of the webhook to update"),
          name: z.string().optional(),
          url: z.string().url().optional(),
          events: z.array(z.string()).optional(),
          enabled: z.boolean().optional(),
          secret: z.string().optional(),
        },
      },
      async ({ id, name, url, events, enabled, secret }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }] }

        const updated = await db.webhook.update({
          where: { id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(url ? { url: url.trim() } : {}),
            ...(events ? { events: events as any } : {}),
            ...(enabled !== undefined ? { enabled } : {}),
            ...(secret !== undefined ? { secret } : {}),
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
          }]
        }
      }
    )

    // ── delete_webhook ───────────────────────────────────────────────────────
    server.registerTool(
      "delete_webhook",
      {
        title: "Delete Webhook",
        description: "Permanently delete a webhook configuration and its log history.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!existing) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }] }

        await db.webhook.delete({ where: { id } })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Webhook '${existing.name}' (${existing.url}) deleted successfully.`
          }]
        }
      }
    )

    // ── test_webhook ─────────────────────────────────────────────────────────
    server.registerTool(
      "test_webhook",
      {
        title: "Test Webhook",
        description: "Dispatch a mock test event to a webhook endpoint to verify its connectivity and response status.",
        inputSchema: {
          id: z.string().describe("ID of the webhook to test"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const webhook = await db.webhook.findFirst({
          where: { id, tenantId: auth.tenantId }
        })
        if (!webhook) return { content: [{ type: "text" as const, text: `❌ Webhook '${id}' not found.` }] }

        const testPayload = {
          event: "webhook.test",
          timestamp: new Date().toISOString(),
          workspace: {
            id: auth.tenantId,
            name: auth.tenantName,
            slug: auth.tenantSlug
          },
          message: "This is a test notification from SaCMS MCP Server."
        }

        const start = Date.now()
        try {
          const res = await fetch(webhook.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "SaCMS-MCP-Webhook/1.0",
              ...(webhook.secret ? { "X-SaCMS-Signature": "test-signature" } : {}),
            },
            body: JSON.stringify(testPayload),
          })
          const duration = Date.now() - start

          return {
            content: [{
              type: "text" as const,
              text: `✅ Webhook test completed in ${duration}ms with HTTP Status ${res.status} (${res.statusText}).`
            }]
          }
        } catch (error: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Webhook test failed: ${error.message || "Endpoint unreachable"}`
            }]
          }
        }
      }
    )

    // =========================================================================
    // 7. API INFORMATION & DOCS GUIDE
    // =========================================================================

    // ── get_api_info ─────────────────────────────────────────────────────────
    server.registerTool(
      "get_api_info",
      {
        title: "Get API Information",
        description: "Get the full REST API documentation, endpoints, filtering syntax, and sample integration code for this workspace.",
        inputSchema: {
          baseUrl: z.string().optional().describe("Public base URL of SaCMS (e.g. https://yourdomain.com)"),
        },
      },
      async ({ baseUrl }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const origin = baseUrl?.replace(/\/$/, "") || "https://your-sacms.com"
        const apiBase = `${origin}/api/public/${auth.tenantSlug}`

        const docs = `# SaCMS API & MCP Integration Guide — Workspace: ${auth.tenantName}

## Base URL
${apiBase}

## Authentication Header
Authorization: Bearer YOUR_API_TOKEN

## Public REST Endpoints
- \`GET ${apiBase}/content/{contentTypeSlug}\` — List published collection entries
- \`GET ${apiBase}/content/{contentTypeSlug}/{id}\` — Get single collection entry by ID
- \`GET ${apiBase}/single/{singleTypeSlug}\` — Get single type content data
- \`POST ${apiBase}/graphql\` — Dynamic GraphQL API Endpoint

## Advanced Query & Filtering Operators
- Pagination: \`?pagination[page]=1&pagination[pageSize]=20\`
- Sorting: \`?sort=createdAt:desc\`
- Full-text Search: \`?search=keyword\`
- Field Selection: \`?fields=title,slug,publishedAt\`
- Relations: \`?populate=category,author\`
- Filter Eq: \`?filters[category][$eq]=tech\`
- Filter Contains: \`?filters[title][$contains]=tutorial\`
- Filter In: \`?filters[tags][$in]=news,updates\`

## Sample Next.js 16 Server Component (with ISR)
\`\`\`tsx
export default async function NewsPage() {
  const res = await fetch(\`${apiBase}/content/articles?pagination[pageSize]=10\`, {
    headers: { Authorization: \`Bearer \${process.env.SACMS_TOKEN}\` },
    next: { revalidate: 60 }
  })
  const { data } = await res.json()
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      {data.map((item: any) => (
        <article key={item.id} className="p-4 border rounded-xl">
          <h2 className="text-xl font-bold">{item.title}</h2>
          <p className="text-muted-foreground">{item.excerpt}</p>
        </article>
      ))}
    </main>
  )
}
\`\`\`
`
        return { content: [{ type: "text" as const, text: docs }] }
      }
    )
  },
  {
    serverInfo: { name: "sacms-mcp", version: "2.0.0" },
  }
)

// ─── HTTP Request Handlers & Protocol Wrapper ─────────────────────────────────

async function authenticateRequest(req: Request) {
  let token = ""
  const authHeader = req.headers.get("authorization")
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.replace("Bearer ", "")
  } else {
    const url = new URL(req.url)
    token = url.searchParams.get("token") || ""
  }

  const auth = await resolveToken(token)
  return auth
}

function patchRequestUrl(req: Request): Request {
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host")
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https"
  
  if (forwardedHost) {
    try {
      const url = new URL(req.url)
      url.host = forwardedHost
      url.port = ""
      url.protocol = forwardedProto ? `${forwardedProto}:` : "https:"
      const newHeaders = new Headers(req.headers)
      newHeaders.set("host", forwardedHost)

      return new Request(url.toString(), {
        method: req.method,
        headers: newHeaders,
        body: req.body,
        duplex: 'half'
      } as any)
    } catch(e) {
      return req
    }
  }
  return req
}

export async function GET(req: Request) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API token." }, { status: 401 })
    }
    const patchedReq = patchRequestUrl(req)
    return await authContext.run(auth, () => handler(patchedReq))
  } catch (error: any) {
    console.error("MCP GET Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API token." }, { status: 401 })
    }
    const patchedReq = patchRequestUrl(req)
    return await authContext.run(auth, () => handler(patchedReq))
  } catch (error: any) {
    console.error("MCP POST Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await authenticateRequest(req)
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API token." }, { status: 401 })
    }
    const patchedReq = patchRequestUrl(req)
    return await authContext.run(auth, () => handler(patchedReq))
  } catch (error: any) {
    console.error("MCP DELETE Error:", error)
    return NextResponse.json({ error: "Internal Server Error", details: error.message }, { status: 500 })
  }
}
