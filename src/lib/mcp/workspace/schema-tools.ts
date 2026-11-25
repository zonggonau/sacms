// registerSchemaTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { getOperation } from "@/lib/infrastructure/global-mcp-operations"
import { getTenantDb } from "@/lib/database"
import { FIELD_TYPES, FIELD_CATEGORIES, VALID_FIELD_TYPES } from "@/lib/field-types"
import { FIELD_TYPE_GUIDE } from "@/lib/field-type-guide"
import { getFullSchemaForTenant, listContentTypesForTenant, getContentTypeForTenant } from "@/lib/cms-introspection"
import { buildGroupTree } from "@/lib/content-type-groups"
import { listContentTypeGroups, createContentTypeGroup, renameContentTypeGroup, reparentContentTypeGroup, reorderContentTypeGroups, deleteContentTypeGroup, assignContentTypeToGroup } from "@/lib/content-type-group-service"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, toSafeSlug, checkRelationDependents } from "./context"

export function registerSchemaTools(server: McpServer) {
    // ── get_full_schema ──────────────────────────────────────────────────────
    server.registerTool("get_operation_status", { description: "Poll an apply or deploy operation in the active workspace.", inputSchema: { operationId: z.string() } }, async ({ operationId }) => {
      const auth = authContext.getStore()
      if (!auth) return UNAUTHORIZED
      if (!hasScope(auth, "read")) return permissionDenied("read")
      const op = await getOperation(operationId, auth.tenantId)
      if (!op) return { isError: true, content: [{ type: "text" as const, text: "Operation not found" }] }
      const structured = { operationId, kind: op.kind, status: op.status, result: op.result, error: op.error, startedAt: op.startedAt.toISOString(), finishedAt: op.finishedAt?.toISOString() ?? null }
      return { structuredContent: structured, content: [{ type: "text" as const, text: JSON.stringify(structured) }] }
    })

    server.registerTool(
      "get_full_schema",
      {
        title: "Get Full Schema",
        description: "Get the complete database schema of the workspace — all Content Types (collections), Single Types (one-off pages), and Components (reusable blocks) with their fields and configurations. This is Phase 1, step 1 of the agent playbook — call get_agent_playbook first if you haven't connected before.",
        inputSchema: {},
        outputSchema: {
          workspace: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
          contentTypes: z.array(z.any()),
          singleTypes: z.array(z.any()),
          components: z.array(z.any()),
        },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const schema = await getFullSchemaForTenant(tenantDb, auth.tenantId, {
          id: auth.tenantId,
          name: auth.tenantName,
          slug: auth.tenantSlug,
        })

        return {
          content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }],
          structuredContent: schema,
        }
      }
    )

    // ── list_field_types ─────────────────────────────────────────────────────
    server.registerTool(
      "list_field_types",
      {
        title: "List Supported Field Types",
        description: "List all 36 supported field types in SaCMS (text, textarea, richText, markdown, slug, number, currency, percent, date, datetime, time, dateRange, select, multiselect, tags, icon, boolean, email, password, url, phone, uid, media, mediaMultiple, file, relation, component, repeater, location, seo, code, json, color, rating, button, document_template). Call this BEFORE creating or modifying any field — it tells you exactly which `options`/`relationSlug` a type actually needs (several documented-sounding options are silently ignored at render time; this flags those explicitly) and what value shape a content entry must use for that field once created.",
        inputSchema: {
          category: z.enum([
            "Basic",
            "Number",
            "Date & Time",
            "Selection",
            "Boolean",
            "Validation",
            "Media",
            "Relations",
            "Advanced"
          ]).optional().describe("Optional category to filter field types"),
        },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        let types = FIELD_TYPES as unknown as any[]
        if (category) {
          types = types.filter(t => t.category.toLowerCase() === category.toLowerCase())
        }

        const fieldDocs = types.map((ft) => {
          const supportedOptions: Record<string, string> = {
            required: "boolean (default false)",
            unique: "boolean (default false)",
            localizable: "boolean (default true - i18n translation)",
          }
          const exampleField: Record<string, any> = {
            name: ft.label,
            slug: ft.type.toLowerCase().replace(/[^a-z0-9]/g, "_"),
            type: ft.type,
            required: false,
          }

          const guide = FIELD_TYPE_GUIDE[ft.type]
          if (guide?.options) {
            supportedOptions.options = guide.options
            if (guide.exampleOptions) exampleField.options = guide.exampleOptions
          }
          if (guide?.relationSlug) {
            supportedOptions.relationSlug = guide.relationSlug
            exampleField.relationSlug = "categories"
          }

          return {
            type: ft.type,
            label: ft.label,
            category: ft.category,
            description: ft.description,
            supportedOptions,
            exampleSchemaField: exampleField,
            // How a content ENTRY's value must be shaped once this field
            // exists — a separate concern from the schema `options` above,
            // undocumented anywhere else an agent could discover it.
            entryValueShape: guide?.entryValue,
            note: guide?.note,
          }
        })

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              totalCount: fieldDocs.length,
              categories: FIELD_CATEGORIES,
              fieldTypes: fieldDocs,
              usageNote: "Pass these field definitions in the 'fields' array of 'create_content_type', 'create_single_type', or 'create_component'. `note` (when present) flags options that are silently ignored at render time, or a real capability that's easy to miss — read it before guessing an options shape for that type.",
            }, null, 2)
          }]
        }
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
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await listContentTypesForTenant(tenantDb, auth.tenantId)

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
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await getContentTypeForTenant(tenantDb, auth.tenantId, slug)

        if (!result) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content Type not found." }, isError: true }

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
      }
    )

    // ── create_content_type ──────────────────────────────────────────────────
    server.registerTool(
      "create_content_type",
      {
        title: "Create Content Type",
        description: "Create a new Content Type collection schema with fields. Call 'list_field_types' FIRST to discover all 36 supported field types and — critically — each one's real `options`/`relationSlug` shape and entry-value shape; several options look plausible but are silently ignored at render time (e.g. currency's currencyCode, media's allowedTypes), and guessing them wastes a turn instead of erroring.",
        inputSchema: {
          name: z.string().describe("Display name (e.g. 'Blog Post', 'Product Item')"),
          slug: z.string().describe("URL-safe slug (e.g. 'articles', 'products')"),
          description: z.string().optional().describe("Description of this collection"),
          showInCms: z.boolean().default(true).describe("Whether to display in CMS sidebar"),
          fields: z.array(
            z.object({
              name: z.string().describe("Field display name (e.g. 'Title', 'Price')"),
              slug: z.string().describe("Field slug (e.g. 'title', 'price')"),
              type: z.enum(VALID_FIELD_TYPES).describe("Field type identifier (e.g. 'text', 'textarea', 'richText', 'currency', 'date', 'mediaMultiple', 'relation', 'repeater', etc. See 'list_field_types' for full list)"),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional().describe("For relation type: slug of target content type"),
              options: z.record(z.string(), z.any()).optional().describe("Extra field options (e.g. { currencyCode: 'IDR' }, { choices: [{label, value}] }, { componentSlug: 'hero' })"),
            })
          ).optional().describe("List of field definitions to create for this Content Type"),
        },
      },
      async ({ name, slug, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const cleanSlug = toSafeSlug(slug)
        const tenantDb = await getTenantDb(auth.tenantSlug)

        // Check if slug already exists
        const existing = await tenantDb.contentType.findFirst({
          where: { tenantId: auth.tenantId, slug: cleanSlug, draftTemplateId: null }
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
                slug: toSafeSlug(f.slug),
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
              type: z.enum(VALID_FIELD_TYPES),
              required: z.boolean().optional().default(false),
              unique: z.boolean().optional().default(false),
              localizable: z.boolean().optional().default(true),
              relationSlug: z.string().optional(),
              options: z.record(z.string(), z.any()).optional(),
            })
          ).optional().describe("New list of fields. If provided (including an empty array), replaces the schema field set."),
        },
      },
      async ({ slug, name, description, showInCms, fields }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content Type not found." }, isError: true }

        // Update fields if provided — an explicit empty array clears them.
        if (fields !== undefined) {
          await tenantDb.schemaField.deleteMany({
            where: { contentTypeId: ct.id }
          })
          if (fields.length > 0) {
            await tenantDb.schemaField.createMany({
              data: fields.map((f, idx) => ({
                contentTypeId: ct.id,
                name: f.name,
                slug: toSafeSlug(f.slug),
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
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const ct = await tenantDb.contentType.findFirst({
          where: {
            draftTemplateId: null,
            OR: [
              { slug, tenantId: auth.tenantId },
              { id: slug, tenantId: auth.tenantId },
            ]
          }
        })
        if (!ct) return { content: [{ type: "text" as const, text: `❌ Content Type '${slug}' not found.` }], structuredContent: { ok: false, code: "NOT_FOUND", message: "Content Type not found." }, isError: true }

        const dependent = await checkRelationDependents(tenantDb, auth.tenantId, ct.slug, { contentTypeId: ct.id })
        if (dependent) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Cannot delete Content Type '${ct.name}' — field '${dependent.fieldName}' on '${dependent.parentName}' still references it via relationSlug. Remove or repoint that field first.`
            }],
            isError: true,
          }
        }

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

    // ── Content Type Groups (sidebar folders for Content Types) ─────────────
    // Mirrors the "Kelola Group" dialog on /developer/content-types exactly
    // — up to 3 levels deep, Content Types only (Single Types have no
    // grouping concept in SaCMS at all, don't invent one). Business logic
    // (depth cap, cycle prevention) lives in content-type-group-service.ts,
    // shared with the dashboard's own Server Actions — not reimplemented
    // here, so the two can never drift apart.

    server.registerTool(
      "list_content_type_groups",
      {
        title: "List Content Type Groups",
        description: "List this workspace's Content Type groups (sidebar folders) as a nested tree, up to 3 levels deep. Groups organize Content Types only — Single Types have no grouping concept in SaCMS.",
        inputSchema: {},
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const { groups } = await listContentTypeGroups(tenantDb, auth.tenantId)
        const tree = buildGroupTree(groups)
        return { content: [{ type: "text" as const, text: JSON.stringify(tree, null, 2) }] }
      },
    )

    server.registerTool(
      "create_content_type_group",
      {
        title: "Create Content Type Group",
        description: "Create a new Content Type group (sidebar folder). Omit parentId for a top-level group, or pass an existing group's id to nest it — nesting is capped at 3 levels total.",
        inputSchema: {
          name: z.string().min(1).describe("Group display name, e.g. 'Marketing', 'E-Commerce'"),
          parentId: z.string().optional().describe("Existing group id to nest this one under. Omit for top-level."),
        },
      },
      async ({ name, parentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await createContentTypeGroup(tenantDb, auth.tenantId, { name, parentId: parentId ?? null })
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return { content: [{ type: "text" as const, text: JSON.stringify(result.group, null, 2) }] }
      },
    )

    server.registerTool(
      "rename_content_type_group",
      {
        title: "Rename Content Type Group",
        description: "Rename an existing Content Type group.",
        inputSchema: {
          id: z.string().describe("Group id"),
          name: z.string().min(1).describe("New name"),
        },
      },
      async ({ id, name }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await renameContentTypeGroup(tenantDb, auth.tenantId, id, name)
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return { content: [{ type: "text" as const, text: JSON.stringify(result.group, null, 2) }] }
      },
    )

    server.registerTool(
      "reparent_content_type_group",
      {
        title: "Move Content Type Group",
        description: "Move a group under a different parent (or to top-level by omitting newParentId). Rejected if it would exceed the 3-level cap, move a group into its own descendant, or into itself.",
        inputSchema: {
          id: z.string().describe("Group id to move"),
          newParentId: z.string().optional().describe("New parent group id. Omit to move to top-level."),
        },
      },
      async ({ id, newParentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await reparentContentTypeGroup(tenantDb, auth.tenantId, id, newParentId ?? null)
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return { content: [{ type: "text" as const, text: JSON.stringify(result.group, null, 2) }] }
      },
    )

    server.registerTool(
      "reorder_content_type_groups",
      {
        title: "Reorder Content Type Groups",
        description: "Set the display order of sibling groups (groups sharing the same parent). Pass EVERY sibling's id in orderedIds, in the desired order — a partial list is rejected.",
        inputSchema: {
          parentId: z.string().optional().describe("Parent group id whose children are being reordered. Omit for top-level groups."),
          orderedIds: z.array(z.string()).min(1).describe("All sibling group ids, in the desired display order."),
        },
      },
      async ({ parentId, orderedIds }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await reorderContentTypeGroups(tenantDb, auth.tenantId, parentId ?? null, orderedIds)
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return { content: [{ type: "text" as const, text: "✅ Urutan grup diperbarui." }] }
      },
    )

    server.registerTool(
      "delete_content_type_group",
      {
        title: "Delete Content Type Group",
        description: "Permanently delete a group AND all its descendant subgroups. Content Types inside the deleted subtree are NOT deleted — they just lose their group assignment (groupId set to null) and fall back to the ungrouped section.",
        inputSchema: {
          id: z.string().describe("Group id to delete"),
        },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "delete")) return permissionDenied("delete")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await deleteContentTypeGroup(tenantDb, auth.tenantId, id)
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return {
          content: [{
            type: "text" as const,
            text: `✅ Grup dihapus (termasuk ${result.descendantGroupCount} subgrup). ${result.orphanedContentTypeCount} Content Type kehilangan grupnya dan pindah ke bagian tanpa grup.`,
          }],
        }
      },
    )

    server.registerTool(
      "assign_content_type_to_group",
      {
        title: "Assign Content Type to Group",
        description: "Put a Content Type into a group, move it to a different group, or ungroup it (omit groupId / pass null).",
        inputSchema: {
          contentTypeId: z.string().describe("Content Type id"),
          groupId: z.string().nullable().optional().describe("Target group id. Pass null (or omit) to ungroup."),
        },
      },
      async ({ contentTypeId, groupId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const tenantDb = await getTenantDb(auth.tenantSlug)
        const result = await assignContentTypeToGroup(tenantDb, auth.tenantId, contentTypeId, groupId ?? null)
        if ("error" in result) return { content: [{ type: "text" as const, text: `❌ ${result.error}` }], isError: true }
        return { content: [{ type: "text" as const, text: JSON.stringify(result.contentType, null, 2) }] }
      },
    )

    // =========================================================================
    // 3. CONTENT ENTRIES CRUD (DATA ENTITIES)
    // =========================================================================
}
