// registerSingleTypeAndComponentTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { db, getTenantDb } from "@/lib/database"
import { VALID_FIELD_TYPES } from "@/lib/field-types"
import { invalidateSingleTypePublication, singleTypeContentWrite } from "@/lib/single-type-publication"
import { listComponentsForTenant, buildRenderHints } from "@/lib/cms-introspection"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, toSafeSlug, checkRelationDependents, countComponentDependents } from "./context"

export function registerSingleTypeAndComponentTools(server: McpServer) {
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
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const singleTypes = await tenantDb.singleType.findMany({
          where: { tenantId: auth.tenantId, draftTemplateId: null },
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
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type (e.g. 'homepage', 'global-settings', 'about')"),
          locale: z.string().optional().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ singleTypeSlug, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const targetLocale = locale || "id"
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId } }
          },
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Single Type not found." }, isError: true }

        const matchingAssignment = st.tenants.find(t => t.locale === targetLocale) || st.tenants[0]
        const renderHints = buildRenderHints(st.schemaFields)

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
          locale: matchingAssignment?.locale || targetLocale,
          ...(renderHints ? { _renderHints: renderHints } : {}),
          data: matchingAssignment?.data || {}
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
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("Field definitions"),
          initialData: z.record(z.string(), z.any()).optional().describe("Initial singleton content values"),
          locale: z.string().default("id").describe("Initial content locale (default 'id')"),
        },
      },
      async ({ name, slug, description, fields, initialData, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.singleType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
        })
        if (existing) return { content: [{ type: "text" as const, text: `❌ Single Type '${cleanSlug}' already exists.` }] }

        const initialLocale = locale || "id"
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
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            },
            tenants: {
              create: {
                tenantId: auth.tenantId,
                locale: initialLocale,
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
          locale: z.string().default("id").describe("Content locale (default 'id')"),
        },
      },
      async ({ singleTypeSlug, data, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const targetLocale = locale || "id"
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Single Type not found." }, isError: true }

        const content = singleTypeContentWrite(data, true)
        const assignment = await tenantDb.tenantSingleTypeAssignment.upsert({
          where: {
            tenantId_singleTypeId_locale: {
              tenantId: auth.tenantId,
              singleTypeId: st.id,
              locale: targetLocale
            }
          },
          update: content,
          create: {
            tenantId: auth.tenantId,
            singleTypeId: st.id,
            locale: targetLocale,
            ...content,
          }
        })
        await invalidateSingleTypePublication(auth.tenantId, st.slug, targetLocale)

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${st.slug}' (${targetLocale}) content saved successfully.\n\n${JSON.stringify(assignment, null, 2)}`
          }]
        }
      }
    )

    // ── update_single_type ───────────────────────────────────────────────────
    server.registerTool(
      "update_single_type",
      {
        title: "Update Single Type Schema",
        description: "Update an existing Single Type's name, description, or add/replace its schema fields.",
        inputSchema: {
          singleTypeSlug: z.string().describe("Slug or ID of the Single Type to update"),
          name: z.string().optional().describe("New display name"),
          description: z.string().optional().describe("New description"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the schema field set."),
        },
      },
      async ({ singleTypeSlug, name, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Single Type not found." }, isError: true }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { singleTypeId: st.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                singleTypeId: st.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            })
          }
        }

        const updated = await tenantDb.singleType.update({
          where: { id: st.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } },
            tenants: { where: { tenantId: auth.tenantId }, take: 1 },
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Single Type '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
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
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const st = await tenantDb.singleType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: singleTypeSlug, tenantId: auth.tenantId },
              { id: singleTypeSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!st) return { content: [{ type: "text" as const, text: `❌ Single Type '${singleTypeSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Single Type not found." }, isError: true }

        const dependent = await checkRelationDependents(tenantDb, auth.tenantId, st.slug, { singleTypeId: st.id })
        if (dependent) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Single Type '${st.name}' — field '${dependent.fieldName}' on '${dependent.parentName}' still references it via relationSlug. Remove or repoint that field first.`
            }],
            isError: true,
          }
        }

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
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await listComponentsForTenant(tenantDb, auth.tenantId)

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── list_global_components / get_global_component (read-only) ───────────
    // Reusable Component field-definitions from SaCMS's platform-wide
    // catalog (built via the separate Global "Schema Template" MCP server)
    // — e.g. a ready-made "Testimonial" or "Pricing Tier". Read-only here,
    // published-only: call get_global_component for its `fields`, then
    // this server's OWN create_component with that same array to actually
    // materialize it into this workspace's schema. This server has no way
    // to write to that catalog — only the Global server can.
    server.registerTool(
      "list_global_components",
      {
        title: "List Global Components (Read-Only)",
        description: "List every PUBLISHED reusable Component field-definition from SaCMS's platform-wide catalog — a ready-made field shape (e.g. 'Testimonial', 'Pricing Tier') you can adapt instead of designing a Component from scratch. Call this before create_component when the user's ask sounds like something generic/common (a testimonial block, a team member card, a pricing tier) rather than specific to this workspace's own data.",
        inputSchema: {
          category: z.string().optional().describe("Filter to one category, e.g. 'testimonial', 'pricing', 'navigation'. Omit to list every category."),
        },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const rows = await db.globalComponent.findMany({
          where: { published: true, ...(category ? { category } : {}) },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, slug: true, icon: true, description: true, category: true },
        })
        return { content: [{ type: "text" as const, text: JSON.stringify({ components: rows }, null, 2) }] }
      },
    )

    server.registerTool(
      "get_global_component",
      {
        title: "Get Global Component (Read-Only)",
        description: "Get one PUBLISHED Global Component's full `fields` array, ready to pass straight into this server's own create_component to materialize it into this workspace's schema.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const component = await db.globalComponent.findFirst({ where: { published: true, OR: [{ id }, { slug: id }] } })
        if (!component) {
          return { content: [{ type: "text" as const, text: `❌ Global Component '${id}' not found (or not published).` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Global Component not found or not published." }, isError: true }
        }
        const result = {
          id: component.id,
          name: component.name,
          slug: component.slug,
          icon: component.icon,
          description: component.description,
          category: component.category,
          fields: component.fields,
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      },
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
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("List of component field definitions"),
        },
      },
      async ({ name, slug, category, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        const existing = await tenantDb.component.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
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
                slug: toSafeSlug(f.slug),
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

    // ── get_component ────────────────────────────────────────────────────────
    server.registerTool(
      "get_component",
      {
        title: "Get Component",
        description: "Fetch schema fields and metadata for a specific Component.",
        inputSchema: {
          componentSlug: z.string().describe("Slug or ID of the Component (e.g. 'hero-banner', 'cta-box')"),
        },
      },
      async ({ componentSlug }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          },
          include: { schemaFields: { orderBy: { order: "asc" } } },
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Component not found." }, isError: true }

        const result = {
          id: c.id,
          name: c.name,
          slug: c.slug,
          category: c.category,
          description: c.description,
          fields: c.schemaFields.map(f => ({
            id: f.id,
            name: f.name,
            slug: f.slug,
            type: f.type,
            required: f.required,
            options: f.options
          }))
        }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── update_component ─────────────────────────────────────────────────────
    server.registerTool(
      "update_component",
      {
        title: "Update Component",
        description: "Update an existing Component's name, category, description, or add/replace its schema fields.",
        inputSchema: {
          componentSlug: z.string().describe("Current slug or ID of the Component to update"),
          name: z.string().optional().describe("New display name"),
          category: z.string().optional().describe("New category (e.g. 'sections', 'elements', 'meta')"),
          description: z.string().optional().describe("New description"),
          fields: z.array(
            z.object({
              name: z.string(),
              slug: z.string(),
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the component's field set."),
        },
      },
      async ({ componentSlug, name, category, description, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Component not found." }, isError: true }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { componentId: c.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                componentId: c.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
                type: f.type,
                required: f.required || false,
                options: f.options || {},
                order: idx,
              }))
            })
          }
        }

        const updated = await tenantDb.component.update({
          where: { id: c.id },
          data: {
            ...(name ? { name: name.trim() } : {}),
            ...(category ? { category: category.trim() } : {}),
            ...(description !== undefined ? { description } : {}),
          },
          include: {
            schemaFields: { orderBy: { order: "asc" } }
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: `✅ Component '${updated.name}' updated successfully.\n\n${JSON.stringify(updated, null, 2)}`
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
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const c = await tenantDb.component.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug: componentSlug, tenantId: auth.tenantId },
              { id: componentSlug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!c) return { content: [{ type: "text" as const, text: `❌ Component '${componentSlug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Component not found." }, isError: true }

        const usedByCount = await countComponentDependents(tenantDb, auth.tenantId, c.slug)
        if (usedByCount > 0) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Component '${c.name}' — still used by ${usedByCount} schema field${usedByCount === 1 ? "" : "s"}. Remove or repoint those fields first.`
            }],
            isError: true,
          }
        }

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
}
