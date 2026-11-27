// registerWebsiteTemplateTools — Global MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { schemaRequirements } from "@/lib/infrastructure/site-schema-contract"
import { previewRoutePaths } from "@/lib/infrastructure/preview-route-paths"
import { db } from "@/lib/database"
import { join } from "node:path"
import { slugify } from "@/lib/slug"
import { schemaTemplateBundleSchema } from "@/lib/validations/schema-template"
import { websiteTemplateFilesSchema, websiteTemplateFileSchema, BINARY_ASSET_EXTENSIONS, type WebsiteTemplateFile } from "@/lib/validations/website-template"
import { validateBundleReferences, splitIssuesBySeverity, remapIssuePathsToInput } from "@/lib/schema-template-validation"
import { composeTemplateStarterSchema, protectedSchemaModelIssues } from "@/lib/infrastructure/template-starter-schema"
import { getOperation } from "@/lib/infrastructure/global-mcp-operations"
import { recordTemplateVersion, type VersionFile } from "@/lib/infrastructure/template-versions"
import { type SchemaBlob } from "@/lib/schema-template-sync"
import { DemoContentError } from "@/lib/infrastructure/demo-content"
import { loadStarterSnapshot, StarterUnavailableError, starterLockBreach, starterLockFor, templateLockKey, writeStarterLock, type StarterSnapshot } from "@/lib/infrastructure/starter-template"
import { McpServer, authContext, UNAUTHORIZED, SchemaTemplateNotFoundError, notFound, APPROVAL_OUTPUT, BUNDLE_FILE_OUTPUT, FILE_SIZE_OUTPUT, describeFileSize, WEBSITE_TEMPLATE_OUTPUT_SHAPE, serializeWebsiteTemplate, serializeWebsiteTemplateSummary, demoFailure, DEMO_DEPLOYMENT_OUTPUT_SHAPE, describeDemoDeployment, DRY_RUN_OUTPUT_SHAPE, ASYNC_OPERATION_OUTPUT_SHAPE, ToolResult, runToolInBackground, requiresPublishScope, queueApprovals, approvalNote, findDemoTenantForSchemaTemplate, runVerifyBuild, invalidSchema, warningsNote, referenceIssuesResponse, dedupeSlug, WEBSITE_TEMPLATE_SUMMARY_SHAPE } from "./context"

export function registerWebsiteTemplateTools(server: McpServer) {
    // ── Website Templates (frontend bundles following a Schema Template) ──

    server.registerTool(
      "list_website_templates",
      {
        title: "List Website Templates",
        description:
          "List Website Templates — frontend source bundles that follow a specific Schema Template's " +
          "structure, built by the SaCMS team. Metadata only (no `files` — call get_website_template for " +
          "that). Call this FIRST before creating a new one, and to check which Website Templates already " +
          "exist for a given Schema Template.",
        inputSchema: {
          schemaTemplateId: z.string().optional().describe("Filter to Website Templates following this Schema Template's id"),
        },
        outputSchema: {
          templates: z.array(z.object({
            id: z.string(), name: z.string(), slug: z.string(), schemaTemplateId: z.string(), icon: z.string(),
            description: z.string().nullable(), published: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
            demoUrl: z.string().nullable(), schemaTemplate: z.object({ name: z.string(), slug: z.string() }),
          })),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ schemaTemplateId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const rows = await db.websiteTemplate.findMany({
          where: { deletedAt: null, ...(schemaTemplateId ? { schemaTemplateId } : {}) },
          orderBy: { createdAt: "desc" },
          select: {
            id: true, name: true, slug: true, schemaTemplateId: true, icon: true,
            description: true, published: true, createdAt: true, updatedAt: true, demoUrl: true,
            schemaTemplate: { select: { name: true, slug: true } },
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
      "get_website_template",
      {
        title: "Get Website Template",
        description: "Get one Website Template's full detail, including its demo deployment state (demoUrl/demoDeploymentId). By default `files` carries the COMPLETE bundle (path + content for every source file, often ~150-200KB) — use `listPathsOnly` first to see what's there cheaply, then `paths` to pull just the handful of files you actually need to read, instead of the whole bundle every time you just want to check or patch one file.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          paths: z.array(z.string()).optional().describe("Only return these exact file paths' content, instead of every file in the bundle. Ignored when listPathsOnly is true."),
          listPathsOnly: z.boolean().optional().describe("Return every file's path, byte size and sha256 (see `fileSizes`) with `files` empty — skips sending any file content at all. Compare sha256 against your local copy to fetch/patch only files that actually differ."),
        },
        outputSchema: {
          ...WEBSITE_TEMPLATE_OUTPUT_SHAPE,
          installation: z.object({ schemaTemplateId: z.string(), schemaTemplateSlug: z.string(), schemaVersion: z.string(), requirements: z.array(z.unknown()) }),
          fileSizes: z.array(FILE_SIZE_OUTPUT).optional().describe("Only populated when listPathsOnly was true. bytes/sha256 are of the real (decoded) bytes, so a binary asset's sha256 matches `sha256sum` of the file on disk."),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, paths, listPathsOnly }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({
          where: { deletedAt: null, OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, name: true, slug: true, schema: true, sourceVersion: true } } },
        })
        if (!template) return notFound("Website Template", id)

        const allFiles = template.files as unknown as WebsiteTemplateFile[]
        let files: WebsiteTemplateFile[] = allFiles
        let fileSizes: ReturnType<typeof describeFileSize>[] | undefined
        if (listPathsOnly) {
          fileSizes = allFiles.map(describeFileSize)
          files = []
        } else if (paths && paths.length > 0) {
          const wanted = new Set(paths)
          files = allFiles.filter((f) => wanted.has(f.path))
        }

        const structured = { ...serializeWebsiteTemplate({ ...template, files }), installation: { schemaTemplateId: template.schemaTemplate.id, schemaTemplateSlug: template.schemaTemplate.slug, schemaVersion: template.schemaTemplate.sourceVersion.toISOString(), requirements: schemaRequirements(template.schemaTemplate.schema) }, ...(fileSizes ? { fileSizes } : {}) }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    // ── get_starter_template ─────────────────────────────────────────────────
    // The SaCMS Next.js starter, read-only: what create_website_template { starter: true } builds on.
    server.registerTool(
      "get_starter_template",
      {
        title: "Read the SaCMS Next.js Starter",
        description:
          "Lists the official SaCMS Next.js starter (github.com/zonggonau/sacms-nextjs-starter, current commit of its default branch): every file that create_website_template { starter: true } locks, and the default schema it brings (Single Types and Component counts). Pass `paths` to read the content of specific files, up to 40 per call. Read-only; nothing is written.",
        inputSchema: {
          paths: z.array(z.string().min(1).max(300)).max(40).optional().describe("Starter file paths to read, exactly as the listing shows them, e.g. ['app/page.tsx', 'src/lib/sacms/content.ts']."),
        },
        outputSchema: {
          ok: z.boolean(),
          message: z.string(),
          repo: z.string().optional(),
          commit: z.string().optional(),
          files: z.array(z.object({ path: z.string(), encoding: z.string(), bytes: z.number() })).optional(),
          schema: z.object({ singleTypes: z.array(z.string()), components: z.number() }).optional(),
          contents: z.array(z.object({ path: z.string(), encoding: z.string(), content: z.string() })).optional(),
        },
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ paths }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        const fail = (code: string, message: string) => ({
          content: [{ type: "text" as const, text: `❌ ${message}` }],
          structuredContent: { ok: false as const, code, message },
          isError: true,
        })

        let snapshot: StarterSnapshot
        try {
          snapshot = await loadStarterSnapshot()
        } catch (error) {
          if (error instanceof StarterUnavailableError) return fail("STARTER_UNAVAILABLE", error.message)
          throw error
        }

        const requested = paths ?? []
        const unknown = requested.filter((p) => !snapshot.files.some((f) => f.path === p))
        if (unknown.length) return fail("INVALID_ARGUMENT", `Bukan file starter: ${unknown.join(", ")}. Panggil tanpa paths untuk melihat daftar file.`)
        const contents = requested.map((p) => {
          const file = snapshot.files.find((f) => f.path === p)!
          return { path: file.path, encoding: file.encoding, content: file.content }
        })
        const contentBytes = contents.reduce((sum, c) => sum + Buffer.byteLength(c.content, "utf8"), 0)
        if (contentBytes > 300_000) return fail("INVALID_ARGUMENT", "Isi file yang diminta melebihi 300KB. Minta lebih sedikit path per panggilan.")

        const message = `Starter ${snapshot.repo}@${snapshot.commit.slice(0, 7)}: ${snapshot.files.length} file, ${snapshot.schema.singleTypes.length} Single Type, ${snapshot.schema.components.length} Component.`
        const structured = {
          ok: true as const,
          message,
          repo: snapshot.repo,
          commit: snapshot.commit,
          files: snapshot.files.map((f) => ({ path: f.path, encoding: f.encoding, bytes: Buffer.byteLength(f.content, "utf8") })),
          schema: { singleTypes: snapshot.schema.singleTypes.map((s) => s.slug), components: snapshot.schema.components.length },
          ...(contents.length ? { contents } : {}),
        }
        return { content: [{ type: "text" as const, text: message }], structuredContent: structured }
      },
    )

    server.registerTool(
      "create_website_template",
      {
        title: "Create Website Template",
        description:
          "Create a new Website Template — a frontend source bundle (Next.js app files, text/code only, no " +
          "binary assets) PLUS the CMS schema it renders, built together in one call. Pass `schema` to define " +
          "a brand-new structure for this frontend (the common case — SaCMS auto-creates the backing Schema " +
          "Template for you, you never need to call create_schema_template separately). Pass `schemaTemplateId` " +
          "instead when attaching files to the Schema Template you prepared, or when reusing an existing structure — " +
          "call list_schema_templates/get_schema_template first to find it. Exactly one of the two is required. " +
          "Call list_website_templates first either way, to avoid creating a near-duplicate. IMPORTANT: include a " +
          "`.env.example` file in `files` listing every env var the frontend reads from process.env — " +
          "\"Terapkan\" parses it and auto-creates matching custom env vars on the workspace's Environment " +
          "tab at apply time. If your frontend doesn't use SaCMS's own fixed names (NEXT_PUBLIC_SACMS_API_URL / " +
          "NEXT_PUBLIC_SACMS_TENANT / SACMS_API_KEY) — e.g. it reads NEXT_PUBLIC_API_URL instead — write the " +
          "value as the literal placeholder `{{SACMS_API_URL}}`, `{{SACMS_TENANT_SLUG}}`, or `{{SACMS_API_KEY}}` " +
          "and it resolves to that workspace's REAL production value on apply, instead of staying empty for " +
          "the customer to guess. Any other var (e.g. NEXT_PUBLIC_SITE_NAME=) is created with its literal " +
          "default value, editable later on the Environment tab.",
        inputSchema: {
          schemaTemplateId: z.string().optional().describe("Reuse an EXISTING Schema Template's structure (id or slug) instead of defining a new one via `schema`. Mutually exclusive with `schema`."),
          schema: schemaTemplateBundleSchema.optional().describe(
            "Define this frontend's CMS structure inline — { groups?: [...], contentTypes: [...], singleTypes: [...], components: [...] }, same shape as create_schema_template's own `schema`. " +
            "Call list_field_types FIRST — it has the real options/relationSlug shape and entry-value shape per field type, and flags options that look plausible but are silently ignored. Never guess one. " +
            "SaCMS merges the starter schema and prepares a demo workspace for the backing Schema Template. Mutually exclusive with `schemaTemplateId`.",
          ),
          excludeDefaultContentTypes: z.array(z.string().min(1).max(100)).max(100).optional().describe(
            "Inline schema only. Omit optional starter Content Types by slug, such as kategori, posts or pages.",
          ),
          includeGlobalComponents: z.array(z.string().min(1).max(150)).max(100).optional().describe(
            "Inline schema only. Published Global Component slugs (from list_global_components) to add to the starter. Not merged automatically — include only what this website uses, since Components can't be removed from a template later.",
          ),
          category: z.string().min(1).max(100).optional().describe("Catalog category for the auto-created backing Schema Template when `schema` is given (e.g. 'Business', 'Blog & News'). Ignored when `schemaTemplateId` is given. Defaults to 'Custom'."),
          name: z.string().min(1).max(150).describe("Template display name, e.g. 'Company Profile — Modern Dark'"),
          icon: z.string().max(10).optional().describe("A single emoji shown on the template card, e.g. '🖥️'"),
          description: z.string().max(500).optional().describe("Short catalog-card blurb shown alongside the name/category."),
          starter: z.boolean().optional().describe(
            "Start from the official SaCMS Next.js starter (read it with get_starter_template). Its files and its default schema (site-settings, homepage, section Components) become this template's base, so pass NO schema, schemaTemplateId or starter files of your own. The starter's files are then LOCKED: update_website_template refuses to change or remove them, and `files` here may only ADD new paths on top. Binary starter files are not included (none exist today).",
          ),
          files: websiteTemplateFilesSchema.optional().describe(
            "Required unless `starter` is true, where these are EXTRA files added on top of the starter's. [{ path, content, encoding? }, ...] — every source file for the frontend (package.json, app/**, " +
            "components/**, tailwind config, etc.) as plain text, PLUS a `.env.example` documenting its env " +
            "vars (see the {{SACMS_*}} placeholder convention above). Max 200 files, 200KB per text file. " +
            "Binary assets (logo, favicon, fonts — usually under public/) go in the same array with " +
            `encoding: "base64" and base64 content (no data: prefix); only for ${BINARY_ASSET_EXTENSIONS.join("/")}, ` +
            "max 1MB each and 5MB in total. Put big photos in the demo's media library (upload_demo_media) instead.",
          ),
          deployDemo: z.boolean().optional().describe("Explicitly release a hosted catalog demo. For interactive preview use start_preview."),
          published: z.boolean().optional().describe(
            "true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately.",
          ),
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission. If this tool's response is ever lost, retry with the SAME key — you'll get back the already-created template instead of a duplicate (and, when `schema` was given, a second orphaned backing Schema Template). Ignored when dryRun is true."),
          dryRun: z.boolean().optional().describe("Validate everything (files, schema shape, relationSlug/componentSlug/allowedComponents references, select/multiselect choices, schemaTemplateId existence) WITHOUT creating anything or deploying a demo. Returns the same validation errors a real call would reject with, each with an exact path like \"schema.contentTypes[2].fields[4].options.choices\" — call this first for anything non-trivial instead of discovering a mistake only after it's already saved."),
          verifyBuild: z.boolean().optional().describe("With dryRun: also run a REAL `next build` of the bundle in a throwaway Vercel sandbox and render-check its routes (catches a bundle that type-checks but fails to build, or builds but 500s at runtime). Takes a few minutes, so it always returns an operationId — poll get_global_operation_status. Nothing is saved or deployed to the demo."),
          background: z.boolean().optional().describe("Run the create + demo deploy in the background and return an operationId immediately instead of holding the connection open for the whole deploy. Poll get_global_operation_status. Pair with idempotencyKey. Ignored with dryRun."),
        },
        outputSchema: z.union([
          DRY_RUN_OUTPUT_SHAPE,
          ASYNC_OPERATION_OUTPUT_SHAPE,
          z.object({ ...WEBSITE_TEMPLATE_SUMMARY_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE }),
        ]),
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async function createWebsiteTemplateTool({ schemaTemplateId, schema, category, name, icon, description, files, published, deployDemo, idempotencyKey, dryRun, verifyBuild, background, starter = false, excludeDefaultContentTypes = [], includeGlobalComponents = [] }) {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published && !dryRun) {
          const denied = requiresPublishScope(auth, "create_website_template")
          if (denied) return denied
        }

        if (background && !dryRun) {
          // eslint-disable-next-line prefer-rest-params
          const args = arguments[0]
          return runToolInBackground("create_website_template", () => createWebsiteTemplateTool({ ...args, background: false }) as Promise<ToolResult>)
        }

        // Idempotent replay — before anything else, so a lost response's
        // retry never creates a second template (or, worse, a second
        // orphaned backing Schema Template when `schema` was given). A
        // dry run never writes anything, so it has no idempotency state
        // to consult or consume.
        if (!dryRun && idempotencyKey) {
          const already = await db.websiteTemplate.findUnique({ where: { idempotencyKey } })
          if (already) {
            // No fresh deploy call was made on this replay — describe the
            // demo status from whatever is already persisted on the row.
            const demoDeployment = describeDemoDeployment({
              url: already.demoUrl,
              deploymentId: already.demoDeploymentId ?? undefined,
            })
            const structured = { ...serializeWebsiteTemplateSummary(already), demoDeployment }
            return {
              content: [{ type: "text" as const, text: `🔁 Replay idempoten — Website Template '${already.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
              structuredContent: structured,
            }
          }
        }

        let starterSnapshot: StarterSnapshot | null = null
        if (starter) {
          if (schemaTemplateId || schema) {
            return {
              content: [{ type: "text" as const, text: "❌ `starter` membawa schema-nya sendiri. Jangan kirim `schema` atau `schemaTemplateId` bersamaan dengan `starter`." }],
              structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "starter and schema/schemaTemplateId are mutually exclusive." },
              isError: true,
            }
          }
          try {
            starterSnapshot = await loadStarterSnapshot()
          } catch (error) {
            if (!(error instanceof StarterUnavailableError)) throw error
            return {
              content: [{ type: "text" as const, text: `❌ ${error.message}` }],
              structuredContent: { ok: false, code: "STARTER_UNAVAILABLE", message: error.message },
              isError: true,
            }
          }
        } else if (!schemaTemplateId && !schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan salah satu: `schemaTemplateId` (pakai Schema Template yang sudah ada) ATAU `schema` (buat Schema Template baru otomatis untuk frontend ini)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "Provide exactly one of schemaTemplateId or schema." },
            isError: true,
          }
        }
        if (schemaTemplateId && schema) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan HANYA salah satu dari `schemaTemplateId` atau `schema`, bukan keduanya — keduanya menyatakan maksud yang berbeda (pakai schema lama vs buat schema baru)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "schemaTemplateId and schema are mutually exclusive." },
            isError: true,
          }
        }
        if (schemaTemplateId && excludeDefaultContentTypes.length) {
          return referenceIssuesResponse([{ path: "excludeDefaultContentTypes", message: "Update the existing Schema Template before attaching a website." }])
        }

        // Validate EVERYTHING before writing anything — files used to be
        // validated only after a `schema`-given call had already created
        // its backing Schema Template, so an invalid `files` payload left
        // that Schema Template permanently orphaned (a real, confirmed
        // bug class: schema+website creation must be all-or-nothing).
        if (starterSnapshot) {
          const starterPaths = new Set(starterSnapshot.files.map((f) => f.path))
          const clash = (files ?? []).find((f) => starterPaths.has(f.path))
          if (clash) {
            return {
              content: [{ type: "text" as const, text: `❌ File starter tidak boleh ditimpa: ${clash.path}. Tambahkan path baru untuk fitur Anda.` }],
              structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: `File starter tidak boleh ditimpa: ${clash.path}.` },
              isError: true,
            }
          }
        }
        const parsedFiles = websiteTemplateFilesSchema.safeParse(starterSnapshot ? [...starterSnapshot.files, ...(files ?? [])] : files)
        if (!parsedFiles.success) return invalidSchema(parsedFiles.error)

        // Third external audit, VAL-16 (upgraded from a dry-run-only
        // warning): a bundle with no package.json at all can never
        // actually build on Vercel — blocks BOTH dryRun and a real save,
        // the same way an invalid `files` payload already does, instead of
        // only surfacing as an opaque failed deploy afterward.
        const hasPackageJson = parsedFiles.data.some((f) => f.path === "package.json")
        if (!hasPackageJson) {
          return referenceIssuesResponse([{ path: "files", message: "No package.json found at the bundle root — a real deploy has no dependencies/scripts to build with." }])
        }

        let bundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        let bundleWarnings: { path: string; message: string }[] = []
        if (starterSnapshot) {
          // The starter's own schema is used as-is: no default Content Types are composed onto it.
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(starterSnapshot.schema))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          bundleWarnings = warnings
          bundleData = starterSnapshot.schema
        } else if (!schemaTemplateId) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const composed = await composeTemplateStarterSchema(parsedBundle.data, excludeDefaultContentTypes, includeGlobalComponents)
          if (!composed.success) return invalidSchema(composed.error)
          if (composed.issues.length) return referenceIssuesResponse(composed.issues)
          const { blocking, warnings } = splitIssuesBySeverity(
            remapIssuePathsToInput(validateBundleReferences(composed.data), composed.data, parsedBundle.data),
          )
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          bundleWarnings = warnings
          bundleData = composed.data
        }

        if (dryRun) {
          // Read-only existence check — the real path's lookup happens
          // INSIDE the transaction below and stays authoritative; this is
          // just early feedback for a call that's never going to write
          // anything regardless.
          if (schemaTemplateId) {
            const found = await db.schemaTemplate.findFirst({ where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] }, select: { id: true } })
            if (!found) return notFound("Schema Template", schemaTemplateId)
          }
          const hasEnvExample = parsedFiles.data.some((f) => f.path === ".env.example" || f.path.endsWith("/.env.example"))
          const warnings: { path: string; message: string }[] = [...bundleWarnings]
          if (!hasEnvExample) {
            warnings.push({ path: "files", message: "No .env.example found — this is advisory only (it won't block a real save), but env vars won't be auto-declared on the workspace's Environment tab when a customer applies this template." })
          }
          if (verifyBuild) {
            const demoTenant = schemaTemplateId ? await findDemoTenantForSchemaTemplate(schemaTemplateId) : null
            return runVerifyBuild(parsedFiles.data, demoTenant, warnings)
          }
          return {
            content: [{
              type: "text" as const,
              text: warnings.length > 0
                ? `✅ Valid, dengan catatan:\n${warnings.map((w) => `- ${w.path}: ${w.message}`).join("\n")}`
                : "✅ Valid — tidak ada masalah ditemukan. Panggil lagi tanpa dryRun untuk benar-benar menyimpan.",
            }],
            structuredContent: { mode: "dry_run" as const, ok: true as const, valid: true as const, issues: [] as { path: string; message: string }[], warnings },
          }
        }

        let schemaTemplate: { id: string; slug: string; name: string; schema: unknown; demoTenantId: string | null }
        let template: Awaited<ReturnType<typeof db.websiteTemplate.create>>
        let seedMissingContent: boolean
        try {
          const result = await db.$transaction(async (tx) => {
            let resolvedSchemaTemplate: typeof schemaTemplate
            if (schemaTemplateId) {
              const found = await tx.schemaTemplate.findFirst({
                where: { OR: [{ id: schemaTemplateId }, { slug: schemaTemplateId }] },
                select: { id: true, slug: true, name: true, schema: true, demoTenantId: true },
              })
              if (!found) throw new SchemaTemplateNotFoundError(schemaTemplateId)
              resolvedSchemaTemplate = found
            } else {
              const schemaSlug = await dedupeSlug(slugify(name) || "schema-template", (s) => tx.schemaTemplate.findUnique({ where: { slug: s } }))
              const { createDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
              const demo = await createDraftDemoWorkspace(tx, { name, slug: schemaSlug }, bundleData!)
              resolvedSchemaTemplate = await tx.schemaTemplate.create({
                data: {
                  name,
                  slug: schemaSlug,
                  category: category || "Custom",
                  icon: icon || "📦",
                  description: null,
                  schema: bundleData!,
                  published: false,
                  demoTenantId: demo.id,
                },
              })
            }

            // Same transaction as the Schema Template create above (when
            // one happened) — a failure here (including the idempotencyKey
            // unique-constraint race below) rolls BOTH back together,
            // instead of leaving that Schema Template orphaned.
            const slug = await dedupeSlug(slugify(name), (s) => tx.websiteTemplate.findUnique({ where: { slug: s } }))
            const firstWebsite = !schemaTemplateId || (await tx.websiteTemplate.count({ where: { schemaTemplateId: resolvedSchemaTemplate.id } })) === 0
            const createdTemplate = await tx.websiteTemplate.create({
              data: {
                name,
                slug,
                schemaTemplateId: resolvedSchemaTemplate.id,
                icon: icon || "🖥️",
                description: description || null,
                files: parsedFiles.data,
                // Publishing waits for a human approval (queued below).
                published: false,
                idempotencyKey: idempotencyKey || null,
              },
            })
            if (starterSnapshot) {
              // Same transaction as the template: a failed lock write rolls the template back too.
              await writeStarterLock(tx, templateLockKey(createdTemplate.id), null, starterLockFor(starterSnapshot))
            }
            return { schemaTemplate: resolvedSchemaTemplate, template: createdTemplate, firstWebsite }
          }, { timeout: 20000 })
          schemaTemplate = result.schemaTemplate
          template = result.template
          seedMissingContent = result.firstWebsite
        } catch (err: any) {
          if (err instanceof SchemaTemplateNotFoundError) {
            return {
              content: [{ type: "text" as const, text: `❌ Schema Template '${err.id}' tidak ditemukan. Panggil list_schema_templates untuk melihat id/slug yang valid.` }],
              structuredContent: { ok: false, code: "NOT_FOUND", message: "Schema Template not found." },
              isError: true,
            }
          }
          // A concurrent call claimed this exact idempotencyKey between
          // our own check at the top of this handler and this transaction
          // — re-read and return the winning row as a replay, same as the
          // check at the top, instead of surfacing the raw P2002 error.
          if (idempotencyKey && err?.code === "P2002") {
            const winner = await db.websiteTemplate.findUnique({ where: { idempotencyKey } })
            if (winner) {
              const demoDeployment = describeDemoDeployment({ url: winner.demoUrl, deploymentId: winner.demoDeploymentId ?? undefined })
              const structured = { ...serializeWebsiteTemplateSummary(winner), demoDeployment }
              return {
                content: [{ type: "text" as const, text: `🔁 Replay idempoten — Website Template '${winner.id}' sudah dibuat untuk idempotencyKey ini.\n${JSON.stringify(structured, null, 2)}` }],
                structuredContent: structured,
              }
            }
          }
          throw err
        }

        await recordTemplateVersion({
          websiteTemplateId: template.id,
          files: parsedFiles.data as VersionFile[],
          schema: schemaTemplate.schema,
          changedBy: auth.tokenName,
          tokenId: auth.tokenId,
        })

        const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
        const demo = deployDemo ? await deployWebsiteTemplateDemo({
          id: template.id,
          sourceVersion: template.sourceVersion,
          slug: template.slug,
          files: parsedFiles.data,
          schemaTemplate,
          seedMissingContent,
        }) : null

        // Re-read rather than patch the in-memory `template` by hand —
        // deployWebsiteTemplateDemo persists the authoritative demo* fields
        // itself (or leaves them untouched on a hard failure), so this is
        // the one query that can't drift from what it actually wrote.
        const saved = (await db.websiteTemplate.findUnique({ where: { id: template.id } })) || template
        const pendingApprovals = published
          ? await queueApprovals(auth, [{ action: "publish_website_template", targetId: template.id, targetName: template.name }])
          : []
        const structured = {
          ...serializeWebsiteTemplateSummary(saved),
          demoDeployment: demo ? { ...describeDemoDeployment(demo), sourceVersion: template.sourceVersion.toISOString() } : { status: "skipped" as const },
          ...(pendingApprovals.length ? { pendingApprovals } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(bundleWarnings) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "update_website_template",
      {
        title: "Update Website Template",
        description:
          "Update an existing Website Template's metadata, files, schema, and/or published status. For a " +
          "TARGETED edit (\"ubah warna header\", \"ganti font\"), prefer changedFiles/deletedFiles over files — " +
          "call get_website_template first if you don't already have the current bundle in this conversation, " +
          "then send only what actually changed; SaCMS merges it onto the full stored bundle so you never risk " +
          "silently dropping an untouched file. Passing `files` instead REPLACES the whole bundle wholesale — " +
          "only use that for a full rewrite, and include every file you want to keep. Pass `schema` to revise " +
          "the backing Schema Template's structure in the same call as a frontend edit (e.g. adding a field the " +
          "new UI needs) — full replacement like `files`, include every model you want to keep. That Schema " +
          "Template may be shared by another Website Template (a second frontend skin reusing it via " +
          "schemaTemplateId) — changing `schema` here changes what BOTH render from. A structural `schema` " +
          "change refuses with code HAS_DEPENDENTS (listing the others) unless confirmSharedUpdate: true.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          name: z.string().min(1).max(150).optional().describe("New display name, if renaming."),
          icon: z.string().max(10).optional().describe("New single-emoji card icon, if changing."),
          description: z.string().max(500).optional().describe("New catalog-card blurb, if changing."),
          files: websiteTemplateFilesSchema.optional().describe("Full replacement for the file bundle. Do not combine with changedFiles/deletedFiles — pick one."),
          changedFiles: z.array(websiteTemplateFileSchema).optional().describe("Only the files being added or changed — every other file in the stored bundle is kept as-is. Each one fully replaces the stored file; a binary asset needs encoding: \"base64\" again."),
          deletedFiles: z.array(z.string()).optional().describe("File paths to remove from the stored bundle entirely."),
          schema: schemaTemplateBundleSchema.optional().describe("Full replacement for the backing Schema Template's groups/contentTypes/singleTypes/components. Call list_field_types first — don't guess an options shape."),
          published: z.boolean().optional().describe("true REQUESTS publication: the item is saved as a draft and a super admin must approve it in the dashboard (returned in pendingApprovals; needs the publish scope). false unpublishes immediately."),
          expectedVersion: z.string().optional().describe("The `sourceVersion` you last read for this template (from get_website_template) — NOT `updatedAt`, which also moves on every demo redeploy even with no source change. If someone else changed files/schema since, this rejects with code: \"CONFLICT\" instead of silently overwriting their change — re-read and retry with the fresh value."),
          deployDemo: z.boolean().optional().describe("Source changes are saved without deploying by default. Set true only for an explicit catalog demo release."),
          confirmSharedUpdate: z.boolean().optional().describe("Required (after confirming with the user) when `schema` is being changed AND another Website Template also follows the same backing Schema Template — see this tool's own description."),
          confirmRemoveDemoContent: z.boolean().optional().describe("Required after user approval to remove a Content Type that still contains demo entries."),
          dryRun: z.boolean().optional().describe("Validate everything (merged files, schema shape/references, expectedVersion conflict, HAS_DEPENDENTS) WITHOUT writing anything or redeploying the demo — same idea as create_website_template's dryRun, call this first for a non-trivial change."),
          verifyBuild: z.boolean().optional().describe("With dryRun: also run a REAL `next build` of the merged bundle in a throwaway Vercel sandbox against this template's demo data, and render-check its routes. Always returns an operationId — poll get_global_operation_status. Nothing is saved or redeployed."),
          background: z.boolean().optional().describe("Run the update + demo redeploy in the background and return an operationId immediately. Poll get_global_operation_status. Ignored with dryRun."),
          restoreFromVersion: z.number().int().min(1).optional().describe("Roll back to a version from list_template_versions: uses that snapshot's files (and its schema too with restoreSchema: true) instead of `files`/`changedFiles`/`schema`, through every guard a normal update has (expectedVersion, HAS_DEPENDENTS, demo content). Combine with dryRun to preview. Recorded as a new version, so a restore can itself be undone."),
          restoreSchema: z.boolean().optional().describe("With restoreFromVersion: also restore the backing Schema Template's schema from that snapshot. Default false (files only)."),
        },
        outputSchema: z.union([
          DRY_RUN_OUTPUT_SHAPE,
          ASYNC_OPERATION_OUTPUT_SHAPE,
          z.object({ ...WEBSITE_TEMPLATE_SUMMARY_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE.optional() }),
        ]),
        // destructive: `files` replaces the whole bundle and `schema` can
        // remove models (with their demo entries) — a client that gates
        // destructive tools behind confirmation must treat this as one.
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
      },
      async function updateWebsiteTemplateTool({ id, name, icon, description, files, changedFiles, deletedFiles, schema, published, expectedVersion, deployDemo, confirmSharedUpdate, confirmRemoveDemoContent, dryRun, verifyBuild, background, restoreFromVersion, restoreSchema }) {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (published === true && !dryRun) {
          const denied = requiresPublishScope(auth, "update_website_template")
          if (denied) return denied
        }

        if (background && !dryRun) {
          // eslint-disable-next-line prefer-rest-params
          const args = arguments[0]
          return runToolInBackground("update_website_template", () => updateWebsiteTemplateTool({ ...args, background: false }) as Promise<ToolResult>)
        }

        if (files !== undefined && (changedFiles !== undefined || deletedFiles !== undefined)) {
          return {
            content: [{ type: "text" as const, text: "❌ Berikan `files` ATAU `changedFiles`/`deletedFiles`, bukan keduanya — keduanya menyatakan maksud yang berbeda (ganti seluruh bundle vs ubah sebagian)." }],
            structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "files is mutually exclusive with changedFiles/deletedFiles." },
            isError: true,
          }
        }

        const existing = await db.websiteTemplate.findFirst({
          where: { deletedAt: null, OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, slug: true, name: true, schema: true, demoTenantId: true, sourceVersion: true } } },
        })
        if (!existing) return notFound("Website Template", id)

        if (restoreFromVersion !== undefined) {
          if (files !== undefined || changedFiles !== undefined || deletedFiles !== undefined || schema !== undefined) {
            return {
              content: [{ type: "text" as const, text: "❌ restoreFromVersion mengambil files/schema dari snapshot — jangan kirim files, changedFiles, deletedFiles, atau schema bersamaan." }],
              structuredContent: { ok: false, code: "INVALID_ARGUMENT", message: "restoreFromVersion is mutually exclusive with files/changedFiles/deletedFiles/schema." },
              isError: true,
            }
          }
          const snapshot = await db.websiteTemplateVersion.findUnique({
            where: { websiteTemplateId_version: { websiteTemplateId: existing.id, version: restoreFromVersion } },
          })
          if (!snapshot) {
            return {
              content: [{ type: "text" as const, text: `❌ Versi ${restoreFromVersion} tidak ditemukan untuk template ini. Panggil list_template_versions untuk melihat versi yang tersedia.` }],
              structuredContent: { ok: false, code: "NOT_FOUND", message: "Template version not found." },
              isError: true,
            }
          }
          files = snapshot.files as unknown as typeof files
          if (restoreSchema && snapshot.schema) schema = snapshot.schema as unknown as typeof schema
        }

        if (expectedVersion && existing.sourceVersion.toISOString() !== expectedVersion) {
          return {
            content: [{ type: "text" as const, text: `⚠️ Conflict: '${existing.name}' sudah diubah sejak ${expectedVersion} — versi saat ini ${existing.sourceVersion.toISOString()}. Panggil get_website_template lagi untuk melihat versi terbaru sebelum menimpa perubahan yang belum kamu lihat.` }],
            structuredContent: { ok: false, code: "CONFLICT", currentVersion: existing.sourceVersion.toISOString(), message: "This template's files/schema were changed since expectedVersion was read." },
            isError: true,
          }
        }

        if (schema !== undefined && !confirmSharedUpdate) {
          const siblings = await db.websiteTemplate.findMany({
            where: { schemaTemplateId: existing.schemaTemplate.id, id: { not: existing.id } },
            select: { id: true, name: true, slug: true },
          })
          if (siblings.length > 0) {
            return {
              content: [{
                type: "text" as const,
                text: `❌ Schema Template '${existing.schemaTemplate.name}' juga dipakai oleh ${siblings.length} Website Template lain: ${siblings.map((d) => `'${d.name}' (${d.slug})`).join(", ")}. Mengubah struktur schema di sini langsung mengubah apa yang mereka tampilkan juga, karena semuanya berbagi row yang sama. Konfirmasi dulu ke pengguna, lalu panggil lagi dengan confirmSharedUpdate: true.`,
              }],
              structuredContent: {
                ok: false,
                code: "HAS_DEPENDENTS",
                dependents: siblings.map((d) => ({ id: d.id, name: d.name, slug: d.slug })),
                message: "The backing Schema Template is shared by another Website Template — a structural change affects it too.",
              },
              isError: true,
            }
          }
        }

        let filesData: z.infer<typeof websiteTemplateFilesSchema> | undefined
        if (files !== undefined) {
          const parsedFiles = websiteTemplateFilesSchema.safeParse(files)
          if (!parsedFiles.success) return invalidSchema(parsedFiles.error)
          filesData = parsedFiles.data
        } else if (changedFiles !== undefined || deletedFiles !== undefined) {
          // Merge onto the bundle already persisted on this row — the DB
          // row IS the full source of truth here (unlike the per-workspace
          // deploy_to_sacms flow, there's no separate "ask Vercel what it
          // has" step needed), so a patch update is a cheap, safe merge.
          const base = existing.files as unknown as WebsiteTemplateFile[]
          const fileMap = new Map<string, WebsiteTemplateFile>(base.map((f) => [f.path, f] as const))
          for (const f of changedFiles || []) fileMap.set(f.path, f)
          for (const path of deletedFiles || []) fileMap.delete(path)
          const merged = Array.from(fileMap.values())
          const parsedFiles = websiteTemplateFilesSchema.safeParse(merged)
          if (!parsedFiles.success) return invalidSchema(parsedFiles.error)
          filesData = parsedFiles.data
        }

        // A template created from the starter keeps the starter's files: changing or removing one is refused.
        if (filesData !== undefined) {
          const starterBreach = await starterLockBreach(templateLockKey(existing.id), filesData)
          if (starterBreach) {
            return {
              content: [{ type: "text" as const, text: `❌ ${starterBreach}` }],
              structuredContent: { ok: false, code: "STARTER_LOCKED", message: starterBreach },
              isError: true,
            }
          }
        }

        // VAL-16 parity with create_website_template: a files/changedFiles
        // edit that ends up dropping package.json entirely would otherwise
        // only surface as an opaque failed deploy once the redeploy below
        // actually runs.
        if (filesData !== undefined && !filesData.some((f) => f.path === "package.json")) {
          return referenceIssuesResponse([{ path: "files", message: "The resulting bundle has no package.json at the root — a real deploy has no dependencies/scripts to build with." }])
        }

        let schemaUpdated = false
        let parsedBundleData: z.infer<typeof schemaTemplateBundleSchema> | undefined
        let bundleWarnings: { path: string; message: string }[] = []
        if (schema !== undefined) {
          const parsedBundle = schemaTemplateBundleSchema.safeParse(schema)
          if (!parsedBundle.success) return invalidSchema(parsedBundle.error)
          const protectedIssues = protectedSchemaModelIssues(existing.schemaTemplate.schema, parsedBundle.data)
          if (protectedIssues.length) return referenceIssuesResponse(protectedIssues)
          const { blocking, warnings } = splitIssuesBySeverity(validateBundleReferences(parsedBundle.data))
          if (blocking.length > 0) return referenceIssuesResponse(blocking)
          bundleWarnings = warnings
          parsedBundleData = parsedBundle.data
          schemaUpdated = true
        }

        if (dryRun) {
          if (parsedBundleData && existing.schemaTemplate.demoTenantId) {
            const { findSchemaDemoWorkspace, checkDemoContentRemoval } = await import("@/lib/infrastructure/demo-tenant")
            const demo = await findSchemaDemoWorkspace(db, existing.schemaTemplate)
            if (!demo) return demoFailure("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
            try {
              await checkDemoContentRemoval(db, demo.id, existing.schemaTemplate.schema as SchemaBlob, parsedBundleData, confirmRemoveDemoContent)
            } catch (error) {
              if (error instanceof DemoContentError) return demoFailure(error.code, error.message)
              throw error
            }
          }
          if (verifyBuild) {
            const demoTenant = await findDemoTenantForSchemaTemplate(existing.schemaTemplate.id)
            const bundle = filesData ?? (existing.files as unknown as WebsiteTemplateFile[])
            return runVerifyBuild(bundle, demoTenant, bundleWarnings)
          }
          return {
            content: [{ type: "text" as const, text: "✅ Valid — tidak ada masalah ditemukan. Panggil lagi tanpa dryRun untuk benar-benar menyimpan." }],
            structuredContent: { mode: "dry_run" as const, ok: true as const, valid: true as const, issues: [] as { path: string; message: string }[], warnings: bundleWarnings },
          }
        }

        // One transaction when both are changing — a website-metadata
        // write failing right after the schema write landed would
        // otherwise leave the two inconsistent with each other.
        const template = await db.$transaction(async (tx) => {
          if (parsedBundleData) {
            const changed = await tx.schemaTemplate.updateMany({
              where: { id: existing.schemaTemplate.id, sourceVersion: existing.schemaTemplate.sourceVersion },
              data: { schema: parsedBundleData, sourceVersion: new Date() },
            })
            if (!changed.count) return null
            if (existing.schemaTemplate.demoTenantId) {
              const { findSchemaDemoWorkspace, syncDraftDemoWorkspace } = await import("@/lib/infrastructure/demo-tenant")
              const demo = await findSchemaDemoWorkspace(tx, existing.schemaTemplate)
              if (!demo) throw new DemoContentError("DEMO_NOT_AVAILABLE", "The configured demo workspace could not be verified.")
              await syncDraftDemoWorkspace(tx, demo.id, existing.schemaTemplate.schema as SchemaBlob, parsedBundleData, { allowContentRemoval: confirmRemoveDemoContent })
            }
          }
          return tx.websiteTemplate.update({
            where: { id: existing.id, ...(expectedVersion ? { sourceVersion: existing.sourceVersion } : {}) },
            data: {
              ...(name !== undefined ? { name } : {}),
              ...(icon !== undefined ? { icon } : {}),
              ...(description !== undefined ? { description } : {}),
              ...(filesData !== undefined ? { files: filesData } : {}),
              // Unpublishing applies directly; publishing waits for a
              // human approval (queued after the transaction).
              ...(published === false ? { published: false } : {}),
              // Only a genuine source change moves sourceVersion — the
              // demo redeploy triggered below (files/schema) or any later
              // metadata-only edit must never invalidate an expectedVersion
              // read against THIS change.
              ...(filesData !== undefined || schemaUpdated ? { sourceVersion: new Date() } : {}),
            },
          })
        }, { timeout: 20000 }).catch((error: unknown) => {
          if (expectedVersion && (error as { code?: string })?.code === "P2025") return null
          if (error instanceof DemoContentError) return error
          throw error
        })
        if (template instanceof DemoContentError) return demoFailure(template.code, template.message)
        if (!template) {
          return {
            content: [{ type: "text" as const, text: "Schema Template berubah selama permintaan. Baca versi terbaru sebelum mencoba kembali." }],
            structuredContent: { ok: false, code: "CONFLICT", message: "Schema Template changed during the update." },
            isError: true,
          }
        }

        const pendingApprovals = published === true && !template.published
          ? await queueApprovals(auth, [{ action: "publish_website_template", targetId: template.id, targetName: template.name }])
          : []

        if (filesData !== undefined || schemaUpdated) {
          await recordTemplateVersion({
            websiteTemplateId: existing.id,
            files: (filesData ?? existing.files) as unknown as VersionFile[],
            schema: parsedBundleData ?? existing.schemaTemplate.schema,
            schemaChanged: schemaUpdated,
            changedBy: auth.tokenName,
            tokenId: auth.tokenId,
            note: restoreFromVersion !== undefined ? `Restored from v${restoreFromVersion}` : undefined,
            baseline: { files: existing.files as unknown as VersionFile[], schema: existing.schemaTemplate.schema },
          })
        }

        // A real file OR schema change warrants a redeploy (the demo needs
        // to reflect either) — a metadata-only edit (name/icon/description/
        // published) shouldn't rebuild it.
        if (deployDemo === true && (filesData !== undefined || schemaUpdated)) {
          // Use the latest definition after an in-place schema update.
          const freshSchemaTemplate = schemaUpdated
            ? await db.schemaTemplate.findUnique({ where: { id: existing.schemaTemplate.id } })
            : existing.schemaTemplate
          const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
          const demo = await deployWebsiteTemplateDemo({
            id: template.id,
          sourceVersion: template.sourceVersion,
            slug: template.slug,
            files: filesData ?? (template.files as unknown as WebsiteTemplateFile[]),
            schemaTemplate: freshSchemaTemplate || existing.schemaTemplate,
          })
          const saved = (await db.websiteTemplate.findUnique({ where: { id: template.id } })) || template
          const structured = {
            ...serializeWebsiteTemplateSummary(saved),
            demoDeployment: { ...describeDemoDeployment(demo), sourceVersion: template.sourceVersion.toISOString() },
            ...(pendingApprovals.length ? { pendingApprovals } : {}),
          }
          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + warningsNote(bundleWarnings) + approvalNote(pendingApprovals) }],
            structuredContent: structured,
          }
        }

        const structured = {
          ...serializeWebsiteTemplateSummary(template),
          demoDeployment: { status: "skipped" as const },
          ...(pendingApprovals.length ? { pendingApprovals } : {}),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) + approvalNote(pendingApprovals) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "delete_website_template",
      {
        title: "Delete Website Template",
        description: "Delete a Website Template from the catalog (soft-delete with recovery window). The Schema Template it followed is unaffected. Published templates require a super admin approval at /admin/developer/approvals before soft-deletion; unpublished templates are soft-deleted immediately. If it has a live demo deployment, that Vercel project is best-effort deleted (failure is logged but doesn't block the soft-delete).",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: { ok: z.literal(true), pendingApproval: APPROVAL_OUTPUT.optional() },
        annotations: { destructiveHint: true, idempotentHint: false, openWorldHint: true },
      },
      async ({ id }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({ where: { OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Website Template", id)

        if (existing.demoVercelProjectId) {
          const { deleteVercelProject } = await import("@/lib/vercel-client")
          await deleteVercelProject(existing.demoVercelProjectId).catch((err) =>
            console.warn(`[delete_website_template] Failed to delete demo Vercel project for ${existing.slug}:`, err),
          )
        }

        if (existing.published) {
          const [pendingApproval] = await queueApprovals(auth, [{
            action: "delete_website_template",
            targetId: existing.id,
            targetName: existing.name,
            details: { published: true },
          }])
          return {
            content: [{ type: "text" as const, text: `⏳ Penghapusan Website Template '${existing.name}' (published) menunggu persetujuan admin di /admin/developer/approvals (id: ${pendingApproval.id}).` }],
            structuredContent: { ok: true as const, pendingApproval },
          }
        }

        await db.websiteTemplate.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
        const structured = { ok: true as const }
        return { content: [{ type: "text" as const, text: `✅ Website Template '${existing.name}' (unpublished) soft-deleted.` }], structuredContent: structured }
      },
    )

    server.registerTool(
      "whoami",
      {
        title: "Who Am I (Token Info)",
        description: "Show which token this session is using: its name, scopes (read / demo / write / publish), the display name of the admin who created it, when it expires, and when it was last used. Call this when a tool returns FORBIDDEN_SCOPE.",
        inputSchema: {},
        outputSchema: {
          tokenId: z.string(),
          name: z.string(),
          scopes: z.array(z.string()),
          createdBy: z.string().nullable(),
          createdAt: z.string(),
          expiresAt: z.string().nullable(),
          lastUsedAt: z.string().nullable(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const token = await db.apiToken.findUnique({
          where: { id: auth.tokenId },
          select: { id: true, name: true, createdBy: true, createdAt: true, expiresAt: true, lastUsedAt: true },
        })
        if (!token) return UNAUTHORIZED
        // Display name only — never the admin's email, which an external AI
        // client (or whoever holds a leaked token) has no need for.
        const creator = token.createdBy
          ? await db.user.findUnique({ where: { id: token.createdBy }, select: { name: true } })
          : null
        const structured = {
          tokenId: token.id,
          name: token.name,
          scopes: auth.scopes,
          createdBy: creator?.name ?? null,
          createdAt: token.createdAt.toISOString(),
          expiresAt: token.expiresAt?.toISOString() ?? null,
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured }
      },
    )

    server.registerTool(
      "get_approval_status",
      {
        title: "Get Approval Request Status",
        description: "Check a publish / default-schema / cascade-delete request that's waiting on a human. These are never applied by the agent: a super admin approves or rejects them in the SaCMS dashboard (/admin/developer/approvals). Status: pending, approved, rejected, or failed (approved but couldn't be applied — see resultMessage).",
        inputSchema: {
          approvalId: z.string().describe("The id from a pendingApprovals / pendingApproval entry."),
        },
        outputSchema: {
          id: z.string(),
          action: z.string(),
          targetId: z.string(),
          targetName: z.string(),
          status: z.string(),
          resultMessage: z.string().nullable(),
          createdAt: z.string(),
          decidedAt: z.string().nullable(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ approvalId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const request = await db.mcpApprovalRequest.findUnique({ where: { id: approvalId } })
        if (!request) {
          return {
            content: [{ type: "text" as const, text: `❌ Permintaan persetujuan '${approvalId}' tidak ditemukan.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "Approval request not found." },
            isError: true,
          }
        }
        const structured = {
          id: request.id,
          action: request.action,
          targetId: request.targetId,
          targetName: request.targetName,
          status: request.status,
          resultMessage: request.resultMessage,
          createdAt: request.createdAt.toISOString(),
          decidedAt: request.decidedAt?.toISOString() ?? null,
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured }
      },
    )

    const registerOperationStatus = (name: string, description: string) =>
      server.registerTool(
      name,
      {
        title: "Get Background Operation Status",
        description,
        inputSchema: {
          operationId: z.string().describe("The operationId returned by the call that started it."),
        },
        outputSchema: {
          operationId: z.string(),
          kind: z.string(),
          status: z.enum(["running", "succeeded", "failed"]),
          result: z.any().optional(),
          error: z.string().nullable(),
          startedAt: z.string(),
          finishedAt: z.string().nullable(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ operationId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const operation = await getOperation(operationId)
        if (!operation) {
          return {
            content: [{ type: "text" as const, text: `❌ Operation '${operationId}' tidak ditemukan.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "Operation not found." },
            isError: true,
          }
        }
        const structured = {
          operationId: operation.id,
          kind: operation.kind,
          status: operation.status as "running" | "succeeded" | "failed",
          result: operation.result ?? undefined,
          error: operation.error,
          startedAt: operation.startedAt.toISOString(),
          finishedAt: operation.finishedAt?.toISOString() ?? null,
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured }
      },
    )
    registerOperationStatus("get_global_operation_status", "Poll a background operation started by create_website_template/update_website_template/redeploy_website_template_demo with background: true, or by a dryRun with verifyBuild: true. Keep polling (every ~10-20s) while status is \"running\". When it finishes, `result` carries the same structuredContent the synchronous call would have returned; on \"failed\", `error` says why.")

    server.registerTool(
      "list_template_versions",
      {
        title: "List Website Template Versions",
        description: "List a Website Template's change history, newest first: version number, a diff summary (+added ~changed -removed files, schema changed), which token made the change, and when. Roll back with update_website_template({ id, restoreFromVersion }); inspect a snapshot first with get_template_version.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          limit: z.number().int().min(1).max(30).default(10).describe("How many recent versions to return (max 30, the retention limit)."),
        },
        outputSchema: {
          versions: z.array(z.object({
            version: z.number(), summary: z.string(), changedBy: z.string().nullable(),
            fileCount: z.number(), hasSchema: z.boolean(), createdAt: z.string(),
          })),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, limit }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] }, select: { id: true } })
        if (!template) return notFound("Website Template", id)
        const rows = await db.websiteTemplateVersion.findMany({
          where: { websiteTemplateId: template.id },
          orderBy: { version: "desc" },
          take: limit,
        })
        const versions = rows.map((v) => ({
          version: v.version,
          summary: v.summary,
          changedBy: v.changedBy,
          fileCount: Array.isArray(v.files) ? v.files.length : 0,
          hasSchema: v.schema !== null,
          createdAt: v.createdAt.toISOString(),
        }))
        return { content: [{ type: "text" as const, text: JSON.stringify(versions, null, 2) }], structuredContent: { versions } }
      },
    )

    server.registerTool(
      "get_template_version",
      {
        title: "Get Website Template Version",
        description: "Read one history snapshot. By default returns each file's path, size and sha256 only — pass `paths` to get specific files' content, so you can diff a version against the current bundle before restoring it.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          version: z.number().int().min(1).describe("Version number from list_template_versions."),
          paths: z.array(z.string()).optional().describe("Return these files' full content."),
          includeSchema: z.boolean().optional().describe("Also return the schema snapshot."),
        },
        outputSchema: {
          version: z.number(),
          summary: z.string(),
          changedBy: z.string().nullable(),
          createdAt: z.string(),
          fileSizes: z.array(FILE_SIZE_OUTPUT),
          files: z.array(BUNDLE_FILE_OUTPUT),
          schema: z.any().optional(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      },
      async ({ id, version, paths, includeSchema }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const template = await db.websiteTemplate.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] }, select: { id: true } })
        if (!template) return notFound("Website Template", id)
        const snapshot = await db.websiteTemplateVersion.findUnique({ where: { websiteTemplateId_version: { websiteTemplateId: template.id, version } } })
        if (!snapshot) {
          return {
            content: [{ type: "text" as const, text: `❌ Versi ${version} tidak ditemukan.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "Template version not found." },
            isError: true,
          }
        }
        const snapshotFiles = (snapshot.files as unknown as VersionFile[]) || []
        const wanted = new Set(paths || [])
        const structured = {
          version: snapshot.version,
          summary: snapshot.summary,
          changedBy: snapshot.changedBy,
          createdAt: snapshot.createdAt.toISOString(),
          fileSizes: snapshotFiles.map(describeFileSize),
          files: snapshotFiles
            .filter((f) => wanted.has(f.path))
            .map((f) => ({ path: f.path, content: f.content, ...(f.encoding === "base64" ? { encoding: "base64" as const } : {}) })),
          ...(includeSchema ? { schema: snapshot.schema } : {}),
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }], structuredContent: structured }
      },
    )

    server.registerTool(
      "get_website_template_demo_status",
      {
        title: "Get Website Template Demo Status (Read-Only)",
        description: "Read a Website Template's demo deployment status WITHOUT redeploying anything — the build stage of its most recent deploy, a FRESH HTTP check of the homepage AND (if the demo has a sitemap.xml) up to 5 more real routes from it, and error logs when something's broken: build log errors if the build itself failed, or RUNTIME log errors if the build succeeded but a specific route still 500s at request time. Call this instead of create_website_template/update_website_template just to check on an existing demo, and before deciding whether redeploy_website_template_demo is actually needed.",
        inputSchema: {
          paths: previewRoutePaths.optional(),
          id: z.string().describe("Website Template id or slug"),
        },
        outputSchema: {
          sourceVersion: z.string().nullable().optional(),
          deployed: z.boolean(),
          demoUrl: z.string().nullable(),
          deploymentId: z.string().nullable(),
          state: z.string().optional(),
          verified: z.boolean().optional(),
          verificationError: z.string().optional(),
          routes: z.array(z.object({ path: z.string(), url: z.string(), sourceVersion: z.string().nullable(), status: z.number().optional(), verified: z.boolean(), error: z.string().optional() })).optional(),
          buildErrorLines: z.array(z.string()).optional(),
          runtimeErrorLines: z.array(z.string()).optional(),
          message: z.string(),
        },
        annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      },
      async ({ id, paths }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        const existing = await db.websiteTemplate.findFirst({ where: { deletedAt: null, OR: [{ id }, { slug: id }] } })
        if (!existing) return notFound("Website Template", id)

        if (!existing.demoVercelProjectId || (!existing.demoDeploymentId && !existing.demoUrl)) {
          const structured = {
            deployed: false,
            demoUrl: null,
            deploymentId: null,
            message: "No demo has ever been deployed for this template. Call create_website_template/update_website_template with files, or redeploy_website_template_demo, to deploy one.",
          }
          return { content: [{ type: "text" as const, text: structured.message }], structuredContent: structured }
        }

        const { getDeploymentStatus, getLatestDeployment, getDeploymentBuildLogs, getRuntimeLogs } = await import("@/lib/vercel-client")
        const { verifyDemoRoutes } = await import("@/lib/infrastructure/deploy-website-template-demo")

        const status = existing.demoDeploymentId
          ? await getDeploymentStatus(existing.demoDeploymentId).catch(() => null)
          : await getLatestDeployment(existing.demoVercelProjectId).catch(() => null)

        // Kabar Nusa report P0: this used to check ONLY the homepage — a
        // demo whose every list/detail route 500'd still reported
        // `verified: true` as long as "/" rendered.
        const verification = existing.demoUrl
          ? await verifyDemoRoutes(existing.demoUrl, { paths, includeHttpStatus: true })
          : { verified: false, routes: [] as { path: string; verified: boolean; error?: string }[] }
        const verificationError = verification.routes.find((r) => !r.verified)?.error

        // chatgpt.md P0: a build this ERRORED never gets promoted onto the
        // alias — the alias just keeps serving whatever deployment was
        // last successful. That means `verification.verified` above can be
        // `true` purely because an OLDER build still works, even while the
        // LATEST build is broken. Reporting `verified: true` in that case
        // would tell a caller the demo reflects their latest change when it
        // actually doesn't — the build's own terminal state must win over
        // a URL check that may be looking at stale content.
        const buildFailed = !!status?.state && /ERROR|FAILED/i.test(status.state)

        let buildErrorLines: string[] | undefined
        let runtimeErrorLines: string[] | undefined
        const deploymentIdForLogs = existing.demoDeploymentId || (status as any)?.id
        if (buildFailed && deploymentIdForLogs) {
          const logs = await getDeploymentBuildLogs(deploymentIdForLogs).catch(() => null)
          if (logs) buildErrorLines = logs.errorLines.slice(-20)
        } else if (!verification.verified && deploymentIdForLogs) {
          // Kabar Nusa report P0: a route 500ing at REQUEST time (not a
          // build failure) never shows up in build logs at all — that's
          // the whole reason get_deployment_runtime_logs exists on the
          // per-workspace server. Same idea here: only worth fetching when
          // the build itself is fine but something still failed to render.
          const runtime = await getRuntimeLogs(existing.demoVercelProjectId, deploymentIdForLogs).catch(() => null)
          if (runtime && runtime.errorLines.length > 0) {
            runtimeErrorLines = runtime.errorLines.slice(-20).map((l) => `[${l.responseStatusCode ?? "?"}] ${l.requestPath ?? ""} ${l.message}`.trim())
          }
        }

        const structured = {
          deployed: true,
          demoUrl: existing.demoUrl,
          deploymentId: existing.demoDeploymentId,
          state: status?.state,
          verified: buildFailed ? false : verification.verified,
          verificationError: buildFailed
            ? `Latest build ${status?.state}.${verification.verified ? " The URL above is still serving a PREVIOUS successful deployment, not this one." : ""} Check buildErrorLines.`
            : verificationError,
          sourceVersion: existing.demoSourceVersion?.toISOString() ?? null,
          routes: verification.routes.map(route => ({ ...route, url: existing.demoUrl!.replace(/\/$/, "") + route.path, sourceVersion: status?.state === "READY" ? existing.demoSourceVersion?.toISOString() ?? null : null })),
          buildErrorLines,
          runtimeErrorLines,
          message: buildFailed
            ? `Latest build FAILED (${status?.state}) — this demo does NOT reflect the latest changes${verification.verified ? ", even though its URL still responds (serving an older deployment)" : ""}. Check buildErrorLines, fix the source, and call redeploy_website_template_demo.`
            : verification.verified
              ? `Demo is live and rendering at ${existing.demoUrl} (${verification.routes.length} route(s) checked).`
              : `Demo is NOT currently verified — ${verification.routes.filter((r) => !r.verified).length} of ${verification.routes.length} checked route(s) failed. ${runtimeErrorLines?.length ? "Check runtimeErrorLines." : "Call redeploy_website_template_demo to try a fresh deploy."}`,
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    server.registerTool(
      "redeploy_website_template_demo",
      {
        title: "Redeploy Website Template Demo",
        description: "Redeploy the demo frontend from the stored files and verify it while preserving the demo entries. Use get_website_template_demo_status to diagnose a failed build. Reset sample content separately with reset_demo_content.",
        inputSchema: {
          id: z.string().describe("Website Template id or slug"),
          background: z.boolean().optional().describe("Run the redeploy in the background and return an operationId immediately. Poll get_global_operation_status."),
        },
        outputSchema: z.union([
          ASYNC_OPERATION_OUTPUT_SHAPE,
          z.object({ ...WEBSITE_TEMPLATE_SUMMARY_SHAPE, demoDeployment: DEMO_DEPLOYMENT_OUTPUT_SHAPE }),
        ]),
        annotations: { destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async function redeployWebsiteTemplateDemoTool({ id, background }) {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED

        if (background) {
          return runToolInBackground("redeploy_website_template_demo", () => redeployWebsiteTemplateDemoTool({ id, background: false }) as Promise<ToolResult>)
        }

        const existing = await db.websiteTemplate.findFirst({
          where: { deletedAt: null, OR: [{ id }, { slug: id }] },
          include: { schemaTemplate: { select: { id: true, slug: true, name: true, schema: true, demoTenantId: true } } },
        })
        if (!existing) return notFound("Website Template", id)

        const { deployWebsiteTemplateDemo } = await import("@/lib/infrastructure/deploy-website-template-demo")
        const demo = await deployWebsiteTemplateDemo({
          id: existing.id,
          sourceVersion: existing.sourceVersion,
          slug: existing.slug,
          files: existing.files as unknown as WebsiteTemplateFile[],
          schemaTemplate: existing.schemaTemplate,
        })

        const saved = (await db.websiteTemplate.findUnique({ where: { id: existing.id } })) || existing
        const structured = { ...serializeWebsiteTemplateSummary(saved), demoDeployment: { ...describeDemoDeployment(demo), sourceVersion: existing.sourceVersion.toISOString() } }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )
}
