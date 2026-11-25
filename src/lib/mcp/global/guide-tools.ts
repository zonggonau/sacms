// registerGuideTools — Global MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { db } from "@/lib/database"
import { join } from "node:path"
import { slugify } from "@/lib/slug"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"
import { validateBundleReferences, splitIssuesBySeverity, remapIssuePathsToInput } from "@/lib/schema-template-validation"
import { composeTemplateStarterSchema, protectedSchemaModelIssues } from "@/lib/infrastructure/template-starter-schema"
import { serializeTenantSchema, type SchemaBlob } from "@/lib/schema-template-sync"
import { DEMO_MEDIA_MAX_BYTES, DEMO_MEDIA_TYPES, DemoContentError, getDemoSingleTypeEntry, updateDemoSingleTypeEntry, listDemoContentEntries, saveDemoContentEntry, uploadDemoMedia, resetDemoContent } from "@/lib/infrastructure/demo-content"
import { McpServer, authContext, UNAUTHORIZED, notFound, APPROVAL_OUTPUT, DEMO_IDENTITY, DEMO_SINGLE_ENTRY, DEMO_COLLECTION_ENTRY, DEMO_TEMPLATE_INPUT, DEMO_SINGLE_INPUT, DEMO_COLLECTION_INPUT, DEMO_ENTRY_DATA, demoFailure, runDemoOperation, describeSchemaDemoWorkspace, SCHEMA_TEMPLATE_OUTPUT_SHAPE, serializeSchemaTemplate, requiresPublishScope, queueApprovals, approvalNote, invalidSchema, warningsNote, referenceIssuesResponse, dedupeSlug, readWebsiteWorkflow, buildFieldTypeReference, buildBuilderGuide } from "./context"

export function registerGuideTools(server: McpServer) {
    // ── get_builder_guide ──────────────────────────────────────────────────
    // Kabar Nusa report bug 4: the full workflow used to live entirely in
    // this server's top-level `instructions` field (6,178 characters) —
    // confirmed live, Claude Code truncates a long MCP `instructions`
    // string outright, cutting it off mid-sentence ("get_w… [truncated]")
    // before it ever reached the guidance that mattered. Same fix as the
    // per-workspace server's own get_agent_playbook: keep `instructions`
    // short (a pointer + the few rules too safety-critical to risk never
    // being read), move the full detail into a tool callable on demand.
    server.registerTool(
      "get_builder_guide",
      {
        title: "Get Builder Guide (Start Here)",
        description: "Read this FIRST when you connect to this MCP server. Returns the full workflow for building a Schema Template + Website Template together, dry-run validation, the demo preview/verification contract, and every structured error code — call with no arguments.",
        inputSchema: {},
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        return { content: [{ type: "text" as const, text: buildBuilderGuide() }] }
      },
    )

    server.registerTool(
      "get_website_agent_workflow",
      {
        title: "SaCMS Global Website Agent Workflow",
        description: "Read the website workflow from brief and task assignment through demo workspace, SaCMS schema, UI/UX, frontend, security review, and verified demo deployment.",
        inputSchema: {},
        outputSchema: { skill: z.literal("sacms-global-website"), workflow: z.string() },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        if (!authContext.getStore()) return UNAUTHORIZED
        const workflow = await readWebsiteWorkflow()
        return {
          content: [{ type: "text" as const, text: workflow }],
          structuredContent: { skill: "sacms-global-website" as const, workflow },
        }
      },
    )

    server.registerTool(
      "list_field_types",
      {
        title: "List Supported Field Types",
        description:
          "List all 36 field types a Schema Template's fields can use, with each one's real `options`/" +
          "`relationSlug` shape and entry-value shape — call this BEFORE writing any field into " +
          "create_schema_template/update_schema_template. Several options look plausible but are silently " +
          "ignored at render time once a tenant applies the template (e.g. currency's currencyCode, media's " +
          "allowedTypes) — this flags those explicitly so you don't guess an options shape that does nothing. " +
          "Also returns `contentApiContract`: real request/response examples for the frontend's actual Content " +
          "API calls (a collection list, a single entry, a populated relation) and what the demo fixture does " +
          "and doesn't seed — read that before scaffolding any fetch call in the frontend you're building.",
        inputSchema: {
          category: z.enum([
            "Basic", "Number", "Date & Time", "Selection", "Boolean",
            "Validation", "Media", "Relations", "Advanced",
          ]).optional().describe("Optional category to filter field types"),
        },
        outputSchema: {
          totalCount: z.number(),
          categories: z.array(z.string()),
          fieldTypes: z.array(z.any()),
          usageNote: z.string(),
          contentApiContract: z.any(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ category }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const structured = buildFieldTypeReference(category)
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "list_schema_templates",
      {
        title: "List Schema Templates",
        description:
          "List every Schema Template in the SaCMS catalog (both published and draft), with id, name, slug, " +
          "category, icon, description, published status, and timestamps — without the full schema blob " +
          "(call get_schema_template for that). Call this FIRST before creating a new template, to check " +
          "whether something close enough already exists.",
        inputSchema: {},
        outputSchema: {
          templates: z.array(z.object({
            id: z.string(), name: z.string(), slug: z.string(), category: z.string(), icon: z.string(),
            description: z.string().nullable(), published: z.boolean(), isDefault: z.boolean(),
            createdAt: z.string(), updatedAt: z.string(),
          })),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        // No sourceVersion here deliberately — this listing is metadata-only
        // (no schema blob either); get_schema_template is the canonical
        // place to read the version to use for a later expectedVersion.
        const rows = await db.schemaTemplate.findMany({
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, category: true, icon: true,
            description: true, published: true, isDefault: true, createdAt: true, updatedAt: true,
          },
        })
        const templates = rows.map((t) => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString() }))
        const structured = { templates }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(templates, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_schema_template",
      {
        title: "Get Schema Template",
        description:
          "Get one Schema Template's full detail, including its complete schema (contentTypes/singleTypes/" +
          "components, each with their exact fields) — the same shape the per-workspace MCP server's " +
          "get_full_schema returns for a real workspace.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
          includeDemoSchema: z.boolean().optional().describe("Read the actual schema rows from this template's own demo workspace."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, includeDemoSchema }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.schemaTemplate.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] } })
        if (!template) return notFound("Schema Template", id)
        const { findSchemaDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        const demo = await findSchemaDemoWorkspace(db, template)
        const structured = {
          ...serializeSchemaTemplate(template),
          ...(demo ? {
            demoWorkspace: {
              ...describeSchemaDemoWorkspace(demo),
              ...(includeDemoSchema ? { schema: await serializeTenantSchema(db, { tenantId: demo.id, draftTemplateId: null }) } : {}),
            },
          } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "get_demo_single_type_entry",
      {
        title: "Read Demo Single Type Entry",
        description: "Read actual demo Single Type values for an exact locale. Returns editor data, public data, publication status, pending draft, and the write version.",
        inputSchema: DEMO_SINGLE_INPUT,
        outputSchema: DEMO_SINGLE_ENTRY,
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => getDemoSingleTypeEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "update_demo_single_type_entry",
      {
        title: "Save Demo Single Type Entry",
        description: "Patch an entry in the linked demo only. Top-level fields not included in the patch are preserved. A supplied Component or Repeater replaces that entire field. Use demo media IDs or returned media URLs. Saves as a draft by default.",
        inputSchema: {
          ...DEMO_SINGLE_INPUT, data: DEMO_ENTRY_DATA,
          publish: z.boolean().default(false).describe("Publish the merged values to the demo Content API."),
          expectedVersion: z.string().nullable().optional().describe("Version from get_demo_single_type_entry, or null for a missing assignment."),
        },
        outputSchema: DEMO_SINGLE_ENTRY,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => updateDemoSingleTypeEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "list_demo_content_entries",
      {
        title: "List Demo Collection Entries",
        description: "List actual Content Type entries and status for an exact demo locale. Use the entry IDs for related data or an update.",
        inputSchema: {
          ...DEMO_COLLECTION_INPUT,
          limit: z.number().int().min(1).max(25).default(10).describe("Entries per page (1-25)."),
          offset: z.number().int().min(0).max(10_000).default(0).describe("Entries to skip; use with hasMore to page."),
        },
        outputSchema: { demo: DEMO_IDENTITY, contentTypeSlug: z.string(), locale: z.string(), entries: z.array(DEMO_COLLECTION_ENTRY), hasMore: z.boolean() },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => listDemoContentEntries(schemaTemplateId, input)),
    )

    server.registerTool(
      "save_demo_content_entry",
      {
        title: "Create or Update a Demo Collection Entry",
        description: "Create a demo collection entry, or patch an existing entry by ID. New entries default to draft. Specify the status when editing an already published entry to control whether the update stays public.",
        inputSchema: {
          ...DEMO_COLLECTION_INPUT, data: DEMO_ENTRY_DATA,
          entryId: z.string().trim().min(1).max(150).optional().describe("Existing entry ID to patch (from list_demo_content_entries). Omit to create a new entry."),
          status: z.enum(["DRAFT", "PUBLISHED"]).optional().describe("Publication status. New entries default to DRAFT; set it explicitly when editing a published entry."),
          expectedVersion: z.string().optional().describe("The entry's version from list_demo_content_entries. A stale value is rejected instead of overwriting a newer edit."),
        },
        outputSchema: { demo: DEMO_IDENTITY, contentTypeSlug: z.string(), entry: DEMO_COLLECTION_ENTRY },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => saveDemoContentEntry(schemaTemplateId, input)),
    )

    server.registerTool(
      "upload_demo_media",
      {
        title: "Upload a Demo Image",
        description: "Upload a PNG, JPEG, WebP, or GIF into the linked demo's media library. Use the returned media ID or stored URL in Media, Component, or Repeater fields.",
        inputSchema: {
          ...DEMO_TEMPLATE_INPUT,
          filename: z.string().trim().min(1).max(150).describe("File name stored in the demo media library, e.g. 'hero.jpg'."),
          mimeType: z.enum(DEMO_MEDIA_TYPES).describe("Image MIME type matching the bytes."),
          base64: z.string().min(4).max(Math.ceil(DEMO_MEDIA_MAX_BYTES / 3) * 4).describe("Base64 image bytes without a data URI prefix, up to 2 MB decoded."),
          alt: z.string().max(500).optional().describe("Alt text for accessibility."),
        },
        outputSchema: {
          demo: DEMO_IDENTITY, reused: z.boolean(),
          media: z.object({ id: z.string(), url: z.string(), mimeType: z.string(), size: z.number() }),
        },
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ schemaTemplateId, ...input }) => runDemoOperation(() => uploadDemoMedia(schemaTemplateId, input)),
    )

    server.registerTool(
      "reset_demo_content",
      {
        title: "Reset Demo Content from Sample Data",
        description: "Explicitly replace demo collection and singleton entries with the template's sample data. Preserves schema and media. Runs independently of frontend deployment.",
        inputSchema: {
          ...DEMO_TEMPLATE_INPUT,
          confirmReset: z.boolean().default(false).describe("Set true only after the user authorizes deleting the current demo entries."),
        },
        outputSchema: {
          demo: DEMO_IDENTITY, deletedEntries: z.number(), deletedAssignments: z.number(),
          status: z.enum(["completed", "partial"]), warnings: z.array(z.object({ model: z.string(), message: z.string() })),
        },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async ({ schemaTemplateId, confirmReset }) => runDemoOperation(() => {
        if (!confirmReset) throw new DemoContentError("CONFIRMATION_REQUIRED", "Confirm the reset before deleting current demo entries.")
        return resetDemoContent(schemaTemplateId)
      }),
    )

    server.registerTool(
      "create_schema_template",
      {
        title: "Create Schema Template",
        description:
          "Create a new Schema Template — a reusable CMS schema blueprint (Content Types, Single Types, and " +
          "Components with their fields) for one type of website/system (e.g. 'Company Profile', 'E-Commerce " +
          "Storefront', 'Blog & News Portal'). Creates a matching internal demo workspace immediately, " +
          "with schema models ready in CMS Studio before any frontend deployment. For a new website, " +
          "omit schema to inspect the platform starter and use update_schema_template to tailor it.",
        inputSchema: {
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile'"),
          category: z.string().min(1).max(100).describe("Catalog category, e.g. 'Business', 'E-Commerce', 'Portfolio'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🏢'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb shown alongside the name/category — not shown to end content editors."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "{ groups?: [...], contentTypes: [...], singleTypes: [...], components: [...] } — each model: " +
            "{ name, slug, description?, fields: [{ name, slug, type, required?, unique?, relationSlug?, componentSlug?, options? }], dummyData?: [...] }. " +
            "Call list_field_types FIRST — it has the real options/relationSlug shape and entry-value shape " +
            "per field type, and flags options that look plausible but are silently ignored. Never guess one. " +
            "Optionally organize Content Types into sidebar folders via `groups`: [{ slug, name, parentSlug? }] " +
            "— `slug` here is a template-local key, NOT a real database id (list parents before children, max " +
            "3 levels) — then set `group: '<that slug>'` on each contentTypes[] entry that belongs in it. " +
            "Single Types and Components have no grouping concept in SaCMS — `group` on those is ignored. " +
            "Omit to load the full starter. Supplied models are merged by slug unless authoring the platform default with isDefault: true.",
          ),
          excludeDefaultContentTypes: z.array(z.string().min(1).max(100)).max(100).optional().describe(
            "Optional starter Content Type slugs to omit once you know the website's needs, such as kategori, posts or pages. Single Types and Components are retained.",
          ),
          includeGlobalComponents: z.array(z.string().min(1).max(150)).max(100).optional().describe(
            "Published Global Component slugs (from list_global_components) to add to the starter. The catalog is NOT merged in automatically — include only the components this website actually uses, since Components can't be removed from a template later.",
          ),
          published: z.boolean().optional().describe(
            "true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately.",
          ),
          isDefault: z.boolean().optional().describe(
            "true REQUESTS that this template seed every new workspace: a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). Only one template is ever the default. false un-defaults it immediately.",
          ),
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission. If this tool's response is ever lost, retry with the SAME key — you'll get back the already-created template (and its already-provisioned demo workspace) instead of a duplicate."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
      },
      async ({ name, category, icon, description, schema, published, isDefault, idempotencyKey, excludeDefaultContentTypes = [], includeGlobalComponents = [] }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published || isDefault) {
          const denied = requiresPublishScope(auth, "create_schema_template")
          if (denied) return denied
        }

        // Idempotent replay — before anything else, so a lost response's
        // retry never creates a second template + a second orphaned demo
        // workspace (createDraftDemoWorkspace below is exactly the kind of
        // expensive, hard-to-undo side effect this key exists to protect).
        if (idempotencyKey) {
          const already = await db.schemaTemplate.findFirst({
            where: { idempotencyKey },
            include: { demoTenant: { select: { id: true, slug: true } } },
          })
          if (already?.demoTenant) {
            const structured = { ...serializeSchemaTemplate(already), demoWorkspace: describeSchemaDemoWorkspace(already.demoTenant) }
            return {
              content: [{ type: "text" as const, text: `🔁 Replay idempoten — Schema Template '${already.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
              structuredContent: structured,
            }
          }
        }

        const parsedSchema = schemaTemplateBundleSchema.safeParse(schema ?? {})
        if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
        let bundle = parsedSchema.data
        if (isDefault && schema !== undefined && excludeDefaultContentTypes.length) {
          return referenceIssuesResponse([{ path: "excludeDefaultContentTypes", message: "Set the platform default's Content Types in its explicit schema." }])
        }
        if (!(isDefault && schema !== undefined)) {
          const composed = await composeTemplateStarterSchema(bundle, excludeDefaultContentTypes, includeGlobalComponents)
          if (!composed.success) return invalidSchema(composed.error)
          if (composed.issues.length) return referenceIssuesResponse(composed.issues)
          bundle = composed.data
        }

        const bundleIssues = validateBundleReferences(bundle)
        const { blocking, warnings } = splitIssuesBySeverity(
          bundle === parsedSchema.data ? bundleIssues : remapIssuePathsToInput(bundleIssues, bundle, parsedSchema.data),
        )
        if (blocking.length > 0) return referenceIssuesResponse(blocking)

        const { createDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        // Saved as a non-default draft; publishing and becoming the default
        // for every new workspace each wait for a human approval below.
        const { template, demo } = await db.$transaction(async (tx) => {
          const slug = await dedupeSlug(slugify(name) || "schema-template", (s) => tx.schemaTemplate.findUnique({ where: { slug: s } }))
          const demo = await createDraftDemoWorkspace(tx, { slug, name }, bundle)
          const template = await tx.schemaTemplate.create({
            data: {
              name, slug, category,
              icon: icon || "📦",
              description: description || null,
              schema: bundle,
              published: false,
              isDefault: false,
              demoTenantId: demo.id,
              idempotencyKey: idempotencyKey || null,
            },
          })
          return { template, demo }
        }, { timeout: 20000 })
        const pendingApprovals = await queueApprovals(auth, [
          ...(published ? [{ action: "publish_schema_template" as const, targetId: template.id, targetName: template.name }] : []),
          ...(isDefault ? [{ action: "set_default_schema_template" as const, targetId: template.id, targetName: template.name }] : []),
        ])
        const structured = {
          ...serializeSchemaTemplate(template),
          demoWorkspace: describeSchemaDemoWorkspace(demo),
          ...(pendingApprovals.length ? { pendingApprovals } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(warnings) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "update_schema_template",
      {
        title: "Update Schema Template",
        description:
          "Update an existing Schema Template's metadata, full schema, and/or published status. Passing " +
          "`schema` REPLACES the whole blob (contentTypes/singleTypes/components) — it is not merged field by " +
          "field, so include every model you want to keep. This Schema Template may be shared by more than one " +
          "Website Template (a second frontend skin reusing it via schemaTemplateId) — changing `schema` here " +
          "changes what ALL of them render from, immediately, since they all point at this same row. Call " +
          "list_website_templates with schemaTemplateId first to see who's affected; if any exist, a structural " +
          "`schema` change refuses with code HAS_DEPENDENTS (listing them) unless confirmSharedUpdate: true.",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          category: z.string().min(1).max(100).optional().describe("New catalog category, if recategorizing."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "Full replacement for groups/contentTypes/singleTypes/components. Call list_field_types first, " +
            "same as create_schema_template — don't guess an options shape. Same `groups`/`group` convention " +
            "too (template-local slugs, Content Types only).",
          ),
          published: z.boolean().optional().describe("true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately."),
          isDefault: z.boolean().optional().describe(
            "true REQUESTS that this template seed every new workspace: a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). Only one template is ever the default. false un-defaults it immediately.",
          ),
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_schema_template) — NOT `updatedAt`, which also moves on a first demo deploy's one-time bookkeeping write even with no `schema` change. If someone else changed `schema` since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND one or more Website Templates already follow this Schema Template — see this tool's own description."),
          confirmRemoveDemoContent: z.boolean().optional().describe("Required after user approval to remove a Content Type that still contains demo entries."),
        },
        outputSchema: SCHEMA_TEMPLATE_OUTPUT_SHAPE,
        annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, name, category, icon, description, schema, published, isDefault, expectedVersion, confirmSharedUpdate, confirmRemoveDemoContent }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published === true || isDefault === true) {
          const denied = requiresPublishScope(auth, "update_schema_template")
          if (denied) return denied
        }

        const existing = await db.schemaTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Schema Template", id)

        if (expectedVersion && existing.sourceVersion.toISOString() !== expectedVersion) {
          return {
            content: [{ type: "text" as const, text: `⚠️ Conflict: '${existing.name}' sudah diubah sejak ${expectedVersion} — versi saat ini ${existing.sourceVersion.toISOString()}. Panggil get_schema_template lagi untuk melihat versi terbaru sebelum menimpa perubahan yang belum kamu lihat.` }],
            structuredContent: { ok: false, code: "CONFLICT", currentVersion: existing.sourceVersion.toISOString(), message: "This template's schema was changed since expectedVersion was read." },
            isError: true,
          }
        }

        let schemaData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        let schemaWarnings: { path: string; message: string }[] = []
        if (schema !== undefined) {
          const parsedSchema = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedSchema.success) return invalidSchema(parsedSchema.error)
          const protectedIssues = protectedSchemaModelIssues(existing.schema, parsedSchema.data)
          if (protectedIssues.length) return referenceIssuesResponse(protectedIssues)
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(parsedSchema.data))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          schemaWarnings = warnings

          if (!confirmSharedUpdate) {
            const dependents = await db.websiteTemplate.findMany({ where: { schemaTemplateId: existing.id }, select: { id: true, name: true, slug: true } })
            if (dependents.length > 0) {
              return {
                content: [{
                  type: "text" as const,
                  text: `❌ '${existing.name}' dipakai oleh ${dependents.length} Website Template: ${dependents.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Mengubah struktur schema ini langsung mengubah apa yang ditampilkan SEMUANYA, karena mereka berbagi row yang sama. Konfirmasi dulu ke pengguna, lalu panggil lagi dengan confirmSharedUpdate: true.`,
                }],
                structuredContent: {
                  ok: false,
                  code: "HAS_DEPENDENTS",
                  dependents: dependents.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
                  message: "This Schema Template is shared by one or more Website Templates — a structural change affects all of them.",
                },
                isError: true,
              }
            }
          }
          schemaData = parsedSchema.data
        }

        const { findSchemaDemoWorkspace, syncDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
        const result = await db.$transaction(async (tx) => {
          const changed = await tx.schemaTemplate.updateMany({
            where: { id: existing.id, sourceVersion: existing.sourceVersion },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(category !== undefined ? { category } : {}),
              ...(icon !== undefined ? { icon } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(schemaData !== undefined ? { schema: schemaData } : {}),
              // Turning these OFF applies directly; turning them ON waits
              // for a human approval (queued after the transaction).
              ...(published === false ? { published: false } : {}),
              ...(isDefault === false ? { isDefault: false } : {}),
              ...(schemaData !== undefined ? { sourceVersion: new Date() } : {}),
            },
          })
          if (!changed.count) return null
          const template = await tx.schemaTemplate.findUniqueOrThrow({ where: { id: existing.id } })
          const demo = await findSchemaDemoWorkspace(tx, template)
          if (schemaData && template.demoTenantId && !demo) {
            throw new DemoContentError("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
          }
          if (schemaData && demo) {
            await syncDraftDemoWorkspace(tx, demo.id, existing.schema as SchemaBlob, schemaData, { allowContentRemoval: confirmRemoveDemoContent })
          }
          return { template, demo }
        }, { timeout: 20000 }).catch((error: unknown) => {
          if (error instanceof DemoContentError) return error
          throw error
        })
        if (result instanceof DemoContentError) return demoFailure(result.code, result.message)
        if (!result) {
          return {
            content: [{ type: "text" as const, text: "Schema Template berubah selama permintaan. Baca versi terbaru sebelum mencoba kembali." }],
            structuredContent: { ok: false, code: "CONFLICT", message: "Schema Template changed during the update." },
            isError: true,
          }
        }
        const pendingApprovals = await queueApprovals(auth, [
          ...(published === true && !result.template.published ? [{ action: "publish_schema_template" as const, targetId: result.template.id, targetName: result.template.name }] : []),
          ...(isDefault === true && !result.template.isDefault ? [{ action: "set_default_schema_template" as const, targetId: result.template.id, targetName: result.template.name }] : []),
        ])
        const structured = {
          ...serializeSchemaTemplate(result.template),
          ...(result.demo ? { demoWorkspace: describeSchemaDemoWorkspace(result.demo) } : {}),
          ...(pendingApprovals.length ? { pendingApprovals } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(schemaWarnings) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "delete_schema_template",
      {
        title: "Delete Schema Template",
        description: "Delete a Schema Template from the catalog (soft-delete with recovery window). Unpublished templates with no Website Template dependents are soft-deleted immediately. Published templates or those with dependents require a super admin approval at /admin/developer/approvals before soft-deletion. Website Templates built on this schema soft-delete with it (cascade is now soft, not permanent).",
        inputSchema: {
          id: z.string().describe("Schema Template id or slug"),
          confirmCascade: z.boolean().optional().describe("When this Schema Template has Website Templates built on it, true REQUESTS the cascade soft-delete — a super admin must approve it. Tell the user exactly what will be deleted."),
        },
        outputSchema: { ok: z.literal(true), deletedDependents: z.number().optional(), pendingApproval: APPROVAL_OUTPUT.optional() },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: false },
      },
      async ({ id, confirmCascade }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (confirmCascade) {
          const denied = requiresPublishScope(auth, "delete_schema_template")
          if (denied) return denied
        }

        const existing = await db.schemaTemplate.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Schema Template", id)

        const dependents = await db.websiteTemplate.findMany({
          where: { schemaTemplateId: existing.id },
          select: { id: true, name: true, slug: true },
        })

        // Published templates or those with dependents require approval
        const needsApproval = existing.published || dependents.length > 0

        if (needsApproval && !confirmCascade) {
          return {
            content: [{
              type: "text" as const,
              text: dependents.length > 0
                ? `❌ '${existing.name}' masih dipakai oleh ${dependents.length} Website Template: ${dependents.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Soft-delete Schema Template ini akan soft-delete semua Website Template tersebut juga. Konfirmasi dulu ke pengguna persis apa yang akan terhapus, lalu panggil lagi dengan confirmCascade: true.`
                : `❌ '${existing.name}' sudah published. Soft-delete published Schema Template membutuhkan persetujuan. Konfirmasi dulu, lalu panggil lagi dengan confirmCascade: true.`,
            }],
            structuredContent: {
              ok: false,
              code: needsApproval ? (dependents.length > 0 ? "HAS_DEPENDENTS" : "IS_PUBLISHED") : undefined,
              dependents: dependents.length > 0 ? dependents.map((d) => ({ id: d.id, name: d.name, slug: d.slug })) : undefined,
              message: dependents.length > 0
                ? "This Schema Template has Website Templates built on it — soft-deleting it would cascade soft-delete them too."
                : "This Schema Template is published — soft-deletion requires approval.",
            },
            isError: true,
          }
        }

        if (needsApproval) {
          const action = dependents.length > 0 ? "cascade_delete_schema_template" : "delete_schema_template"
          const [pendingApproval] = await queueApprovals(auth, [{
            action,
            targetId: existing.id,
            targetName: existing.name,
            details: {
              dependents: dependents.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
              published: existing.published,
            },
          }])
          return {
            content: [{ type: "text" as const, text: `⏳ Soft-delete '${existing.name}'${dependents.length > 0 ? ` beserta ${dependents.length} Website Template` : ' (published)'} menunggu persetujuan admin di /admin/developer/approvals (id: ${pendingApproval.id}).` }],
            structuredContent: { ok: true as const, pendingApproval },
          }
        }

        // Unpublished with no dependents: soft-delete immediately
        await db.schemaTemplate.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
        return {
          content: [{ type: "text" as const, text: `✅ Schema Template '${existing.name}' (unpublished) soft-deleted.` }],
          structuredContent: { ok: true as const, deletedDependents: 0 },
        }
      },
    )
}
