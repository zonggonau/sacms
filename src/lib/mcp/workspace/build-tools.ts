// registerBuildTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { activeSchema, schemaRequirements } from "@/lib/infrastructure/site-schema-contract"
import { db, getTenantDb } from "@/lib/database"
import { startOrResumeBuildRun, getBuildRun } from "@/lib/infrastructure/mcp-build-run"
import { getLatestDeploymentSource } from "@/lib/infrastructure/mcp-deployment-source"
import { McpServer, authContext, UNAUTHORIZED, hasScope, permissionDenied, trackWorkspaceOperation } from "./context"

export function registerBuildTools(server: McpServer) {
    // ── apply_website_template ────────────────────────────────────────────────
    // Kabar Nusa report P0: applying a catalog Website Template to a real
    // workspace was dashboard-only ("Terapkan" button) — no MCP path at
    // all, so an agent that just built/browsed one with the platform's
    // global-schema MCP server had no way to actually hand it to a
    // workspace without a human switching to the dashboard mid-flow. Reuses
    // the exact same apply logic as the dashboard button (see
    // src/lib/infrastructure/apply-website-template.ts) rather than a
    // second copy.
    server.registerTool(
      "apply_website_template",
      {
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        title: "Apply a Catalog Website Template to This Workspace",
        description: "Materializes a published Website Template's schema (Content Types/Single Types/Components) into THIS workspace and saves its bundled frontend for Sandbox editing — the same \"Terapkan\" action available from the dashboard's Website Template tab/gallery, now callable directly. Only works on a workspace with NO existing Content Types/Single Types/Components (call get_full_schema first to confirm it's actually empty) — applying on top of unrelated existing structures would silently skip slug-conflicting models and leave a confusing mix behind. This server has no catalog-browsing tool of its own (Website Templates are platform-wide, not per-workspace) — get the template id/slug from the dashboard's gallery or from whoever is directing this build.",
        inputSchema: {
          dryRun: z.boolean().optional(),
          background: z.boolean().optional(),
          templateId: z.string().describe("Website Template id or slug to apply, e.g. from the dashboard's Website Template gallery URL or card."),
        },
        outputSchema: z.union([
          z.object({ mode: z.literal("dry_run"), plan: z.record(z.string(), z.unknown()) }),
          z.object({ operationId: z.string(), status: z.literal("running") }),
          z.object({
            ok: z.literal(true),
            imported: z.number(),
            envVarsApplied: z.array(z.string()),
            sourceRevision: z.string(),
            message: z.string(),
          }),
          z.object({
            ok: z.literal(false),
            code: z.enum(["NOT_FOUND", "WORKSPACE_NOT_EMPTY", "PAYMENT_REQUIRED"]),
            message: z.string(),
          }),
        ]),
      },
      async function applyTemplate({ templateId, dryRun, background }) {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const websiteTemplate = await db.websiteTemplate.findFirst({
          where: { OR: [{ id: templateId }, { slug: templateId }], published: true },
          include: { schemaTemplate: { select: { schema: true } } },
        })
        if (!websiteTemplate) {
          const structured = { ok: false as const, code: "NOT_FOUND" as const, message: `Website Template '${templateId}' tidak ditemukan atau belum dipublikasikan.` }
          return { content: [{ type: "text" as const, text: `❌ ${structured.message}` }], structuredContent: structured, isError: true }
        }

        // Free for Enterprise when unpriced; every other plan must have bought this template. Buying
        // happens in the dashboard (Website Template tab), never through MCP.
        const { canApplyWithAccess, resolveWebsiteTemplateAccess, WEBSITE_TEMPLATE_ACCESS_MESSAGE } = await import("@/lib/billing/website-template-access")
        const templateAccess = await resolveWebsiteTemplateAccess(auth.tenantId, websiteTemplate)
        if (!canApplyWithAccess(templateAccess)) {
          const reason = WEBSITE_TEMPLATE_ACCESS_MESSAGE[templateAccess as keyof typeof WEBSITE_TEMPLATE_ACCESS_MESSAGE]
          const structured = { ok: false as const, code: "PAYMENT_REQUIRED" as const, message: `${reason} Beli atau upgrade di /dashboard/${auth.tenantSlug}/website-templates.` }
          return { content: [{ type: "text" as const, text: `❌ ${structured.message}` }], structuredContent: structured, isError: true }
        }

        if (dryRun) {
          const [current, snapshot, tenantDb] = await Promise.all([activeSchema(auth.tenantId, auth.tenantSlug), getLatestDeploymentSource(auth.tenantId), getTenantDb(auth.tenantSlug)])
          const { getWebsiteTemplateRun } = await import("@/lib/infrastructure/website-template-run")
          const [run, contentType, singleType, component] = await Promise.all([
            getWebsiteTemplateRun(auth.tenantId),
            tenantDb.contentType.findFirst({ where: { tenantId: auth.tenantId }, select: { slug: true } }),
            tenantDb.singleType.findFirst({ where: { tenantId: auth.tenantId, slug: { not: "site-settings" } }, select: { slug: true } }),
            tenantDb.component.findFirst({ where: { tenantId: auth.tenantId }, select: { slug: true } }),
          ])
          const canApply = run ? run.templateId === websiteTemplate.id && run.expiresAt <= Date.now() : !(contentType || singleType || component)
          const incoming = schemaRequirements(websiteTemplate.schemaTemplate.schema)
          const exists = (m: typeof incoming[number]) => current.some(c => c.kind === m.kind && c.slug === m.slug)
          const incomingFiles = websiteTemplate.files as { path: string; content: string; encoding?: string }[]
          const incomingPaths = incomingFiles.map(f => f.path)
          const oldFiles = new Map(snapshot?.files.map(f => [f.name, f]) ?? [])
          const filesToReplace = incomingFiles.filter(file => {
            const old = oldFiles.get(file.path)
            return old && (old.content !== file.content || (old.encoding ?? "utf-8") !== (file.encoding ?? "utf-8"))
          }).map(file => file.path)
          const oldPaths = snapshot?.files.map(f => f.name) ?? []
          const plan = {
            templateVersion: websiteTemplate.sourceVersion.toISOString(), schemaTemplateId: websiteTemplate.schemaTemplateId,
            canApply, resumesExistingRun: run?.templateId === websiteTemplate.id,
            modelsToAdd: incoming.filter(m => !exists(m)), slugConflicts: incoming.filter(m => exists(m) && !(m.kind === "singleTypes" && m.slug === "site-settings")),
            mergedModels: incoming.filter(m => exists(m) && m.kind === "singleTypes" && m.slug === "site-settings"),
            filesToReplace, unchangedFiles: incomingPaths.filter(path => oldFiles.has(path) && !filesToReplace.includes(path)), filesToAdd: incomingPaths.filter(path => !oldPaths.includes(path)),
            filesRemovedFromNewRevision: oldPaths.filter(path => !incomingPaths.includes(path)), existingSourceVersion: snapshot?.id ?? null,
            contentImpact: { existingEntries: await tenantDb.contentEntry.count({ where: { tenantId: auth.tenantId, deletedAt: null } }), entriesDeleted: 0 },
            policy: "Apply requires an empty workspace, except the built-in site-settings singleton; existing saved source remains in history.",
          }
          return { structuredContent: { mode: "dry_run" as const, plan }, content: [{ type: "text" as const, text: JSON.stringify(plan) }] }
        }
        if (background) return trackWorkspaceOperation("apply_website_template", auth.tenantId, () => applyTemplate({ templateId, dryRun: false, background: false }))
        const { applyWebsiteTemplateToTenant } = await import("@/lib/infrastructure/apply-website-template")
        const result = await applyWebsiteTemplateToTenant(auth.tenantId, auth.tenantSlug, websiteTemplate as any)

        if (!result.ok) {
          const structured = { ok: false as const, code: result.code, message: result.message }
          return { content: [{ type: "text" as const, text: `❌ ${result.message}` }], structuredContent: structured, isError: true }
        }

        const structured = {
          ok: true as const,
          imported: result.imported,
          envVarsApplied: result.envVarsApplied,
          sourceRevision: result.sourceRevision,
          message: `✅ Website Template '${websiteTemplate.name}' diterapkan — ${result.imported} model schema dibuat, source website tersimpan untuk preview.`,
        }
        return {
          content: [{ type: "text" as const, text: structured.message }],
          structuredContent: structured,
        }
      },
    )

    // ── start_website_build ──────────────────────────────────────────────────
    server.registerTool(
      "start_website_build",
      {
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
        title: "Start or Resume a Website Build",
        description: "The entry point for any build, create, or revise request against this workspace's website/app — call it before get_full_schema whenever the ask is build-shaped, not just schema/content browsing. Example intents this covers: \"buatkan portal berita untuk workspace ini dan deploy ke SaCMS\", \"ubah warna header website saya\", \"ganti logo di website yang sudah ada\", \"lanjutkan build kemarin\" / \"build a responsive news site and deploy it to SaCMS\", \"change the header color on my site\", \"continue the build from before\". Returns a runId tied to this workspace — keep it to resume this build later with get_build_run, and call get_build_run (even from a brand-new conversation) to resume exactly where a previous attempt left off if this one gets interrupted. This tool only registers intent and flags a target conflict up front if one exists — it never touches schema or deploys anything by itself. If the user only asked for a plan, design, or preview rather than an actual live deploy, stop there and show it to them — do not open start_preview or deploy just because you called this.",
        inputSchema: {
          intent: z.enum(["create", "update"]).optional().describe("\"create\" for a brand-new website, \"update\" for a revision of whatever is already live. Omit to auto-detect: \"update\" if this workspace already has a deployment, \"create\" otherwise."),
        },
        outputSchema: {
          runId: z.string(),
          intent: z.enum(["create", "update"]),
          stage: z.string(),
          resumed: z.boolean(),
          hostingProjectId: z.string().optional(),
          conflict: z.boolean(),
          existingUrl: z.string().optional(),
          nextStep: z.string(),
          nextAction: z.object({
            tool: z.string().nullable(),
            args: z.record(z.string(), z.unknown()).optional(),
            reason: z.string(),
          }),
        },
      },
      async ({ intent }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        try {
          const tenant = await db.tenant.findUnique({
            where: { id: auth.tenantId },
            select: { vercelDeploymentUrl: true, vercelProjectId: true },
          })
          const resolvedIntent: "create" | "update" = intent || (tenant?.vercelDeploymentUrl ? "update" : "create")
          const { run, resumed } = await startOrResumeBuildRun(auth.tenantId, resolvedIntent)
          const conflict = resolvedIntent === "create" && !!tenant?.vercelDeploymentUrl

          // Structured next step, branched by intent/stage — a revision
          // request must NOT be pointed at schema/scaffold like a brand-new
          // build is (chatgpt1.md P1 finding: the old generic nextStep did
          // exactly that, even for "update").
          const nextAction = conflict
            ? { tool: null, reason: `Workspace already has a live site at ${tenant?.vercelDeploymentUrl}. Confirm with the user whether this is a revision of it or a brand-new site that replaces it.` }
            : resumed
              ? { tool: "get_build_run", args: { runId: run.id }, reason: `Resuming an in-progress run at stage "${run.stage}" — re-check its state before continuing instead of starting over.` }
              : resolvedIntent === "update"
                ? { tool: "get_deployment_source", args: {}, reason: "This is a revision of a site that's already live — read the current deployed files with get_deployment_source, then make only the requested change in start_preview, save it, and an administrator releases it." }
                : { tool: "get_full_schema", args: {}, reason: "This is a brand-new build — discover the real schema before scaffolding any UI." }

          const structured = {
            runId: run.id,
            intent: resolvedIntent,
            stage: run.stage,
            resumed,
            hostingProjectId: run.hostingProjectId || tenant?.vercelProjectId || undefined,
            conflict,
            existingUrl: conflict ? tenant?.vercelDeploymentUrl || undefined : undefined,
            nextStep: conflict
              ? `Workspace already has a live site at ${tenant?.vercelDeploymentUrl}. Confirm with the user whether this is a revision of it (get_deployment_source, then start_preview) or a brand-new site that replaces it.`
              : resumed
                ? `Resuming an in-progress run at stage "${run.stage}" — call get_build_run anytime to re-check this state. Continue from where it left off instead of starting over.`
                : resolvedIntent === "update"
                  ? "This is a revision of an already-live site — call get_deployment_source first to read the current files, then open start_preview and change only what the user asked for. Save with save_preview_changes; an administrator releases it."
                  : "Call get_agent_playbook for the full phase order, then get_full_schema, scaffold the frontend, open start_preview, and save with save_preview_changes. Keep this runId to resume the build later with get_build_run.",
            nextAction,
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal memulai build run: ${err.message}` }],
            structuredContent: { ok: false, code: "BUILD_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── get_build_run ─────────────────────────────────────────────────────────
    server.registerTool(
      "get_build_run",
      {
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        title: "Get Build Run Status (Resume After an Interruption)",
        description: "Fetch a build run's current state — call this at the start of a new conversation when the user refers back to a build/revision you (or another session) started earlier (\"lanjutkan website kemarin\", \"continue the site we were building\"), instead of starting over from scratch. Also the recovery path when a deploy_to_sacms/deploy_website_patch response was lost: pass the SAME idempotencyKey you submitted with to find out what actually happened, instead of guessing or resubmitting blind. Omit both to get this workspace's most recent run.",
        inputSchema: {
          runId: z.string().optional().describe("A specific run's id, from start_website_build. Omit to fetch this workspace's most recent run."),
          idempotencyKey: z.string().optional().describe("Look up the run by the idempotencyKey you passed to deploy_to_sacms/deploy_website_patch instead of a runId — use this when that call's response never arrived."),
        },
        outputSchema: {
          runId: z.string(),
          intent: z.string(),
          stage: z.string(),
          hostingProjectId: z.string().optional(),
          deploymentId: z.string().optional(),
          sourceRevision: z.string().optional(),
          lastError: z.string().optional(),
          updatedAt: z.string(),
        },
      },
      async ({ runId, idempotencyKey }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const run = await getBuildRun(auth.tenantId, runId, idempotencyKey)
          if (!run) {
            return {
              content: [{ type: "text" as const, text: runId || idempotencyKey ? `❌ Build run tidak ditemukan untuk workspace ini.` : "❌ Belum ada build run untuk workspace ini — mulai dengan start_website_build." }],
              structuredContent: { ok: false, code: "NOT_FOUND", message: "No matching build run." },
              isError: true,
            }
          }

          const structured = {
            runId: run.id,
            intent: run.intent,
            stage: run.stage,
            hostingProjectId: run.hostingProjectId || undefined,
            deploymentId: run.deploymentId || undefined,
            sourceRevision: run.sourceRevision || undefined,
            lastError: run.lastError || undefined,
            updatedAt: run.updatedAt.toISOString(),
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal mengambil build run: ${err.message}` }],
            structuredContent: { ok: false, code: "BUILD_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )
}
