// registerGlobalComponentTools — Global MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { db } from "@/lib/database"
import { slugify } from "@/lib/slug"
import { schemaTemplateFieldSchema } from "@/lib/validations/schema-template"
import { createGlobalComponentSchema, updateGlobalComponentSchema } from "@/lib/validations/global-component"
import { splitIssuesBySeverity, validateGlobalComponentFields } from "@/lib/schema-template-validation"
import { McpServer, authContext, UNAUTHORIZED, notFound, requiresPublishScope, queueApprovals, approvalNote, invalidSchema, warningsNote, referenceIssuesResponse, GLOBAL_COMPONENT_OUTPUT_SHAPE, serializeGlobalComponent, serializeGlobalComponentSummary, dedupeSlug, GLOBAL_COMPONENT_SUMMARY_SHAPE } from "./context"

export function registerGlobalComponentTools(server: McpServer) {
    // ── Global Components ───────────────────────────────────────────────
    // Reusable CMS schema field definitions (a "Testimonial" with name/
    // role/photo/quote, a "Pricing Tier", ...) — built here, and once
    // `published`, readable by every workspace's own per-workspace MCP
    // server (list_global_components/get_global_component there,
    // read-only) so an agent can reuse/adapt a ready-made field shape
    // instead of designing a Component from scratch every time. Schema
    // only, deliberately no frontend code bundle — a workspace that wants
    // to use one reads `fields` here, then calls its own create_component
    // with that same array to materialize a real Component in its own
    // schema. Much simpler than Website Template: no SchemaTemplate link,
    // no demo deployment, no expectedVersion/CONFLICT machinery.
    server.registerTool(
      "list_global_components",
      {
        title: "List Global Components",
        description: "List every reusable Component field-definition in the catalog (both published and draft), with id, name, slug, icon, description, category, published status, and timestamps — without the field array itself (call get_global_component for that). Call this FIRST before creating a new one, to check whether something close enough already exists to reuse or extend.",
        inputSchema: {
          category: z.string().optional().describe("Filter to one category, e.g. 'navigation', 'testimonial', 'pricing', 'form'. Omit to list every category."),
        },
        outputSchema: { components: z.array(z.object(GLOBAL_COMPONENT_SUMMARY_SHAPE)) },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const rows = await db.globalComponent.findMany({
          where: category ? { category } : undefined,
          orderBy: { createdAt: "desc" },
        })
        const components = rows.map(serializeGlobalComponentSummary)
        const structured = { components }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(components, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_global_component",
      {
        title: "Get Global Component",
        description: "Get one reusable Component's full detail, including its complete `fields` array — the exact shape a per-workspace MCP server's get_global_component also hands back, ready to pass straight into that workspace's own create_component to materialize it.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const component = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!component) return notFound("Global Component", id)
        const structured = serializeGlobalComponent(component)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "create_global_component",
      {
        title: "Create Global Component",
        description: "Create a new reusable Component field-definition (e.g. 'Testimonial', 'Pricing Tier', 'Team Member') other templates and workspaces can reuse once published. This is catalog data, same as Schema/Website Templates — it never touches any tenant's own live schema or content. Call list_global_components first to avoid creating a near-duplicate, and list_field_types before writing any field.",
        inputSchema: {
          name: z.string().min(1).max(150).describe("Display name, e.g. 'Testimonial'"),
          slug: z.string().max(150).optional().describe("URL-safe identifier, e.g. 'testimonial'. Auto-derived from name if omitted; a collision gets a numeric suffix."),
          icon: z.string().max(10).optional().describe("A single emoji shown on the component's catalog card, e.g. '💬'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb — what this component is for and when to reach for it."),
          category: z.string().max(50).optional().describe("Catalog category, e.g. 'navigation', 'testimonial', 'pricing', 'form' — used to filter list_global_components."),
          fields: z.array(schemaTemplateFieldSchema).describe(
            "[{ name, slug, type, required?, unique?, relationSlug?, componentSlug?, options? }, ...] — same per-field shape as one SchemaTemplate component's own `fields`. Call list_field_types FIRST — it has the real options/relationSlug shape per type, never guess one. A relationSlug/componentSlug here legitimately points at something that may not exist yet — it only needs to resolve once a workspace actually applies these fields via its own create_component.",
          ),
          published: z.boolean().optional().describe("true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately."),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ name, slug: slugInput, icon, description, category, fields, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published) {
          const denied = requiresPublishScope(auth, "create_global_component")
          if (denied) return denied
        }

        const parsed = createGlobalComponentSchema.safeParse({ name, slug: slugInput, icon, description, category, fields, published })
        if (!parsed.success) return invalidSchema(parsed.error)

        const { blocking, warnings } = splitIssuesBySeverity(validateGlobalComponentFields(parsed.data.fields))
        if (blocking.length > 0) return referenceIssuesResponse(blocking)

        const slug = await dedupeSlug(parsed.data.slug || slugify(name), (s) => db.globalComponent.findUnique({ where: { slug: s } }))

        const component = await db.globalComponent.create({
          data: {
            name,
            slug,
            icon: icon || "🧩",
            description: description || null,
            category: category || null,
            fields: parsed.data.fields,
            // Publishing waits for a human approval (queued below).
            published: false,
          },
        })
        const pendingApprovals = published
          ? await queueApprovals(auth, [{ action: "publish_global_component", targetId: component.id, targetName: component.name }])
          : []
        const structured = { ...serializeGlobalComponent(component), ...(pendingApprovals.length ? { pendingApprovals } : {}) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(warnings) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "update_global_component",
      {
        title: "Update Global Component",
        description: "Update an existing Global Component's metadata, field array, and/or published status. Passing `fields` REPLACES the whole array — include every field you want to keep, not just the ones that changed.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          category: z.string().max(50).optional().describe("New category, if recategorizing."),
          fields: z.array(schemaTemplateFieldSchema).optional().describe("Full replacement for the `fields` array — same shape as create_global_component."),
          published: z.boolean().optional().describe("true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately."),
        },
        outputSchema: GLOBAL_COMPONENT_OUTPUT_SHAPE,
        annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, name, icon, description, category, fields, published }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published === true) {
          const denied = requiresPublishScope(auth, "update_global_component")
          if (denied) return denied
        }

        const existing = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Global Component", id)

        const parsed = updateGlobalComponentSchema.safeParse({ name, icon, description, category, fields, published })
        if (!parsed.success) return invalidSchema(parsed.error)

        let fieldWarnings: { path: string; message: string }[] = []
        if (parsed.data.fields !== undefined) {
          const { blocking, warnings } = splitIssuesBySeverity(validateGlobalComponentFields(parsed.data.fields))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          fieldWarnings = warnings
        }

        const component = await db.globalComponent.update({
          where: { id: existing.id },
          data: {
            ...(name !== undefined ? { name } : {}),
            ...(icon !== undefined ? { icon } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(parsed.data.fields !== undefined ? { fields: parsed.data.fields } : {}),
            // Unpublishing applies directly; publishing waits for approval.
            ...(published === false ? { published: false } : {}),
          },
        })
        const pendingApprovals = published === true && !component.published
          ? await queueApprovals(auth, [{ action: "publish_global_component", targetId: component.id, targetName: component.name }])
          : []
        const structured = { ...serializeGlobalComponent(component), ...(pendingApprovals.length ? { pendingApprovals } : {}) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(fieldWarnings) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "delete_global_component",
      {
        title: "Delete Global Component",
        description: "Permanently delete a Global Component from the catalog. This has no effect on any real Component already materialized in a tenant's own schema previously — it only stops it from being found/reused in future.",
        inputSchema: {
          id: z.string().describe("Global Component id or slug"),
        },
        outputSchema: { ok: z.literal(true) },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.globalComponent.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Global Component", id)

        await db.globalComponent.delete({ where: { id: existing.id } })
        const structured = { ok: true as const }
        return { content: [{ type: "text" as const, text: `✅ Global Component '${existing.name}' dihapus.` }], structuredContent: structured }
      },
    )
}
