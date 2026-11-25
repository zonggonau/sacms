// registerDeployTools — Workspace MCP tools (split out of route.ts; see context.ts).
import { z } from "zod"
import { activeSchema, compareSchema } from "@/lib/infrastructure/site-schema-contract"
import { previewRoutePaths } from "@/lib/infrastructure/preview-route-paths"
import { db, getTenantDb } from "@/lib/database"
import { deployToVercel, getLatestDeployment, getDeploymentFiles, getDeploymentBuildLogs, getRuntimeLogs, addDomainToProject, getDomainConfig, upsertVercelProjectEnv, disableVercelDeploymentProtection, type VercelEnvTarget } from "@/lib/vercel-client"
import { getBuildRun, advanceBuildRun } from "@/lib/infrastructure/mcp-build-run"
import { saveDeploymentSource, getLatestDeploymentSource, getDeploymentSourceByRevision, getDeploymentSourceByDeploymentId, listDeploymentSources, type DeploymentSourceFile } from "@/lib/infrastructure/mcp-deployment-source"
import { findSourceIssues } from "@/lib/infrastructure/deployment-source-guard"
import { safeFetch } from "@/lib/safe-url"
import { rateLimit } from "@/lib/rate-limit"
import { McpServer, authContext, UNAUTHORIZED, resolveSubdomainLabel, hasScope, permissionDenied, resolveOwnProjectId, runHttpChecks, resolveDeploymentId, resolveIdempotency, trackWorkspaceOperation } from "./context"

export function registerDeployTools(server: McpServer) {
    // ── deploy_to_sacms ──────────────────────────────────────────────────────
    server.registerTool(
      "deploy_to_sacms",
      {
        title: "Deploy Website / App to SaCMS Cloud Hosting (Staging — Does NOT Go Live)",
        description: "One-shot STAGING build from the supplied source. This is NOT the normal release path: for building or editing use start_preview → apply_preview_changes → save_preview_changes, then an administrator releases from Infrastructure → Hosting. Use this only when the user explicitly asks for a one-shot staging deploy.",
        inputSchema: {
          background: z.boolean().optional(),
          projectName: z.string().optional().describe("Ignored — kept only for backward compatibility with older callers. The deploy always targets this workspace's one locked hosting project, never a caller-chosen name (a different name here would silently orphan the previous project from configure_deployment_domain/add_deployment_env/make_deployment_public, which only ever manage the workspace's current project)."),
          files: z.array(z.object({
            name: z.string().describe("File path (e.g. 'app/page.tsx', 'index.html', 'styles.css')"),
            content: z.string().describe("Raw source content, or base64-encoded bytes when encoding is \"base64\""),
            encoding: z.enum(["utf-8", "base64"]).optional().describe("Defaults to \"utf-8\" (plain text source). Set to \"base64\" for binary assets — a PNG app icon, favicon, or font file — base64-encoded by you first; this tool cannot carry raw bytes over JSON."),
          })).describe("Array of files to deploy — the FULL set, not just what changed. For a targeted revision with only some files changed, use deploy_website_patch instead."),
          envVars: z.record(z.string(), z.string()).optional().describe("Extra env vars for this deploy, merged on top of the workspace's saved Environment vars (the SaCMS API URL/tenant/key are always injected automatically)"),
          intent: z.enum(["create", "update"]).optional().describe("Set to \"create\" when the user wants a brand-new website and this ISN'T a revision of whatever is already deployed. When omitted/\"update\", behaves exactly as before (always deploys, no conflict check) — for backward compatibility with callers that don't know about this field."),
          confirmOverwrite: z.boolean().optional().describe("Set to true to proceed with intent: \"create\" even though a deployment already exists — only after the user has explicitly confirmed they want to replace it."),
          runId: z.string().optional().describe("The runId from start_website_build, if you called it for this request — advances that run's recorded stage/deploymentId so get_build_run reflects reality even if this conversation gets interrupted right after."),
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission (e.g. a hash of the files+intent). If this tool's response is ever lost, retry with the SAME key — you'll get back the already-completed deployment instead of a second one. Omit if you don't need this (default behavior is unchanged)."),
        },
        outputSchema: {
          ok: z.boolean(), operationId: z.string().optional(), status: z.string().optional(),
          code: z.string().optional(),
          deploymentId: z.string().optional(),
          sourceRevision: z.string().optional(),
          productionUrl: z.string().optional(),
          deploymentUrl: z.string().optional(),
          url: z.string().optional(),
          promoted: z.boolean().optional(),
          state: z.string().optional(),
          projectId: z.string().optional(),
          projectName: z.string().optional(),
          envKeysSent: z.array(z.string()).optional(),
          simulated: z.boolean().optional(),
          retryAfterSeconds: z.number().optional(),
          message: z.string(),
        },
      },
      async ({ background, ...args }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")
        if (!background) return deploySiteFiles(args)
        const op = await trackWorkspaceOperation("deploy_to_sacms", auth.tenantId, () => deploySiteFiles(args))
        return { ...op, structuredContent: { ...op.structuredContent, ok: true, message: "Poll get_operation_status." } }
      },
    )

    async function deploySiteFiles({ files, envVars, intent, confirmOverwrite, runId, idempotencyKey }: {
      files: { name: string; content: string; encoding?: "utf-8" | "base64" }[]
      envVars?: Record<string, string>
      intent?: "create" | "update"
      confirmOverwrite?: boolean
      runId?: string
      idempotencyKey?: string
    }) {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Fitur deploy SaCMS Cloud Hosting memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        // Target-conflict guard: only engages when the caller explicitly
        // declares intent "create" (old callers that never pass `intent`
        // keep today's exact always-overwrite behavior — see the
        // backward-compat note on that field above). A "brand-new site"
        // request against a workspace that already has a live deployment
        // must surface the conflict instead of silently replacing it.
        if (intent === "create" && !confirmOverwrite) {
          const existing = await db.tenant.findUnique({
            where: { id: auth.tenantId },
            select: { vercelDeploymentUrl: true },
          })
          if (existing?.vercelDeploymentUrl) {
            return {
              content: [{
                type: "text" as const,
                text: `⚠️ Target Conflict: Workspace '${auth.tenantSlug}' sudah punya website live di ${existing.vercelDeploymentUrl}. SaCMS Cloud Hosting hanya mendukung SATU project per workspace — deploy ini akan MENIMPA website yang sudah ada, bukan membuat yang baru terpisah. Konfirmasi dulu ke pengguna apakah memang ingin menimpanya, lalu panggil ulang deploy_to_sacms dengan confirmOverwrite: true — atau, kalau maksudnya memang merevisi website yang sudah ada, panggil lagi tanpa intent: "create".`
              }],
              structuredContent: {
                ok: false,
                code: "TARGET_CONFLICT",
                url: existing.vercelDeploymentUrl,
                message: "Workspace already has a live deployment — confirm before overwriting.",
              },
              isError: true,
            }
          }
        }

        // Idempotency check — before the rate limit, since a replay/
        // in-progress outcome never triggers a real deploy and shouldn't
        // consume that budget.
        const idem = await resolveIdempotency(auth, idempotencyKey, intent === "create" ? "create" : "update")
        if (idem.kind === "in_progress") {
          return {
            content: [{ type: "text" as const, text: `⏳ Deploy dengan idempotencyKey ini masih berjalan (runId: ${idem.run.id}) — jangan kirim ulang, cek get_build_run atau tunggu sebentar.` }],
            structuredContent: { ok: false, code: "DEPLOY_IN_PROGRESS", message: "A deploy with this idempotencyKey is already in progress." },
            isError: true,
          }
        }
        if (idem.kind === "replay") {
          const structured = {
            ok: true,
            deploymentId: idem.run.deploymentId || undefined,
            sourceRevision: idem.run.sourceRevision || undefined,
            productionUrl: idem.status?.productionUrl || undefined,
            deploymentUrl: idem.status?.deploymentUrl || undefined,
            url: idem.status?.productionUrl || undefined,
            state: idem.status?.state || "UNKNOWN",
            projectId: idem.run.hostingProjectId || "",
            message: "Idempotent replay: this idempotencyKey already completed a deploy — returning that result instead of deploying again.",
          }
          return {
            content: [{ type: "text" as const, text: `🔁 Replay idempoten — deployment ${structured.deploymentId} sudah ada untuk idempotencyKey ini.` }],
            structuredContent: structured,
          }
        }
        const effectiveRunId = runId || idem.effectiveRunId

        // A dedicated cooldown, separate from the general per-tenant MCP
        // rate limit (shared with cheap read calls) — each deploy triggers
        // a real Vercel build, so an uncapped loop here runs up real
        // hosting/build cost even within the general limit's budget.
        const deployLimit = await rateLimit(`mcp_deploy:${auth.tenantId}`, { limit: 3, windowSeconds: 300 })
        if (!deployLimit.success) {
          // This request was rejected BEFORE anything was sent to Vercel —
          // release the idempotency claim (if any) back to "retryable"
          // instead of leaving it stuck in a state the next identical-key
          // retry would misread as still in progress (chatgpt3.md).
          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, { stage: "failed", lastError: "RATE_LIMITED" })
          }
          const retryAfterSeconds = Math.max(1, Math.ceil((deployLimit.resetAt - Date.now()) / 1000))
          return {
            content: [{ type: "text" as const, text: `❌ Terlalu banyak percobaan deploy. Maksimal 3 deploy per 5 menit per workspace — coba lagi dalam ${retryAfterSeconds} detik, dengan idempotencyKey yang SAMA kalau kamu memberikan satu.` }],
            structuredContent: { ok: false, code: "RATE_LIMITED", retryAfterSeconds, message: "Too many deploy submissions in this window." },
            isError: true,
          }
        }

        try {
          // Normalize a missing per-file encoding to "utf-8" up front — a
          // caller omitting it entirely (not just a plain text file) must
          // not leave `undefined` sitting in what gets persisted. deployToVercel
          // already defaults this internally for the Vercel call itself, but
          // it was never applied to what saveDeploymentSource stores, so a
          // later read-back failed validating files[].encoding against its
          // required enum. One normalized array, used for both calls below.
          const normalizedFiles = (files as { name: string; content: string; encoding?: "utf-8" | "base64" }[]).map((f) => ({
            ...f,
            encoding: f.encoding || ("utf-8" as const),
          }))

          // Assemble the workspace's full frontend env (saved Environment
          // vars + fixed SACMS_* connection vars), then let the caller's
          // envVars override any non-reserved key.
          const { resolveFrontendEnv, pushEnvToVercelProject, resolveApiOrigin } = await import(
            "@/lib/infrastructure/frontend-env"
          )
          const resolvedEnv = await resolveFrontendEnv(auth.tenantId, auth.tenantSlug, resolveApiOrigin())
          const mergedEnv: Record<string, string> = { ...(envVars as Record<string, string> | undefined), ...resolvedEnv }

          // Same fixed naming convention as deployTenantFrontend()
          // (dashboard deploy button, AI Site Publish) — one hosting
          // project per tenant, always. A caller-chosen name here would
          // create a second, parallel project on a later call and orphan
          // the first one from configure_deployment_domain/
          // add_deployment_env/make_deployment_public, which only ever
          // resolve the workspace's *current* vercelProjectId.
          const lockedProjectName = `sacms-${auth.tenantSlug}`
          // Always deploys to a STAGING candidate, never directly to
          // production — see this tool's own description and
          // promoteDeployment's doc comment for why. Nothing a visitor
          // sees changes until promote_deployment is called.
          const subdomainLabel = await resolveSubdomainLabel(auth.tenantId, auth.tenantSlug)
          const result = await deployToVercel(lockedProjectName, normalizedFiles, mergedEnv, subdomainLabel, "staging")

          if (result.projectId && !result.simulated) {
            pushEnvToVercelProject(result.projectId, mergedEnv).catch((e) =>
              console.warn("[MCP deploy_to_sacms] env push failed:", e),
            )
          }

          // Associate the project (so configure_deployment_domain/
          // add_deployment_env/etc. have something to act on, including on
          // a brand-new workspace's very first deploy) WITHOUT marking
          // anything as live — only promote_deployment, once this
          // candidate is verified, updates vercelDeploymentUrl.
          if (auth.tenantId && result.projectId) {
            try {
              await Promise.all([
                db.tenant.update({
                  where: { id: auth.tenantId },
                  data: { vercelProjectId: result.projectId },
                }),
                db.setting.upsert({
                  where: { key: `${auth.tenantId}_vercelProjectId` },
                  update: { value: result.projectId },
                  create: { tenantId: auth.tenantId, key: `${auth.tenantId}_vercelProjectId`, value: result.projectId }
                }),
              ])
            } catch (persistErr) {
              console.warn("[MCP deploy_to_sacms] Failed to persist project id to database:", persistErr)
            }
          }

          // Persist the exact file set just deployed — SaCMS's own source
          // of truth for get_deployment_source/deploy_website_patch, not
          // re-derived from Vercel's files API (which, pre-fix, silently
          // skipped lockfiles — see mcp-deployment-source.ts). A failure
          // here must never fail a deploy that already succeeded.
          let sourceRevision: string | undefined
          try {
            const saved = await saveDeploymentSource(
              auth.tenantId,
              result.id,
              result.projectId,
              normalizedFiles as DeploymentSourceFile[],
              await activeSchema(auth.tenantId, auth.tenantSlug).catch(() => undefined),
            )
            sourceRevision = saved.id
          } catch (e) {
            console.warn("[MCP deploy_to_sacms] Failed to persist source snapshot:", e)
          }

          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, {
              stage: "staged",
              deploymentId: result.id,
              sourceRevision: sourceRevision || result.id,
              hostingProjectId: result.projectId || undefined,
              lastError: null,
            })
          }

          return {
            content: [{
              type: "text" as const,
              text: `Staging: ${result.deploymentUrl || result.url}. Rilis dari Infrastruktur → Hosting.`
            }],
            structuredContent: {
              ok: true,
              code: "AWAITING_PROMOTION",
              deploymentId: result.id,
              sourceRevision,
              // Deliberately NOT the live production domain — see this
              // tool's own description. `url`/`productionUrl` mirror
              // `deploymentUrl` here on purpose: this candidate's own URL
              // is the only thing that actually changed.
              productionUrl: result.url,
              deploymentUrl: result.deploymentUrl,
              url: result.url,
              promoted: false,
              state: result.state,
              projectId: result.projectId || "",
              projectName: result.projectName || lockedProjectName,
              envKeysSent: Object.keys(mergedEnv),
              simulated: !!result.simulated,
              message: "Staging ready for review. Release from Infrastructure → Hosting.",
            },
          }
        } catch (err: any) {
          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, { stage: "failed", lastError: err.message })
          }
          return {
            content: [{
              type: "text" as const,
              text: `❌ Gagal deploy ke SaCMS Cloud Hosting: ${err.message}`
            }],
            structuredContent: { ok: false, code: "DEPLOYMENT_FAILED", message: err.message },
            isError: true,
          }
        }
    }

    server.registerTool(
      "deploy_site_version",
      {
        title: "Deploy a Saved Workspace Source Version",
        description: "Deploy a specific saved sourceVersion to staging. Release from Infrastructure → Hosting.",
        inputSchema: { background: z.boolean().optional(), sourceVersion: z.string().min(1), siteId: z.string().optional(), idempotencyKey: z.string().optional() },
      },
      async ({ sourceVersion, siteId, idempotencyKey, background }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")
        const snapshot = await getDeploymentSourceByRevision(auth.tenantId, sourceVersion)
        const site = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { vercelProjectId: true } })
        if (!site || !snapshot || (siteId && siteId !== site.vercelProjectId) ||
          (snapshot.projectId && snapshot.projectId !== site.vercelProjectId)) {
          return { isError: true, content: [{ type: "text" as const, text: "Version not found for this workspace site" }] }
        }
        if (findSourceIssues(snapshot.files).length) {
          return { isError: true, content: [{ type: "text" as const, text: "Invalid saved source. Re-import with get_deployment_source." }] }
        }
        const run = () => deploySiteFiles({ files: snapshot.files, intent: "update", idempotencyKey })
        return background ? trackWorkspaceOperation("deploy_site_version", auth.tenantId, run) : run()
      },
    )
    // ── deploy_website_patch ─────────────────────────────────────────────────
    server.registerTool(
      "deploy_website_patch",
      {
        title: "Deploy a Targeted Revision (Changed Files Only, Staging — Does NOT Go Live)",
        description: "Build a staging candidate by patching a saved sourceRevision. Deploy Production is available in Infrastructure → Hosting.",
        inputSchema: {
          baseSourceRevision: z.string().describe("The sourceRevision this patch is based on — from a previous deploy_to_sacms/deploy_website_patch/rollback_website response, or get_deployment_source."),
          changedFiles: z.array(z.object({
            name: z.string().describe("File path, exactly as it appears in the base source (e.g. 'app/page.tsx')."),
            content: z.string().describe("The file's new full content (not a diff) — raw source, or base64 when encoding is \"base64\"."),
            encoding: z.enum(["utf-8", "base64"]).optional().describe("Defaults to \"utf-8\". Use \"base64\" for a changed binary asset."),
          })).describe("Only the files being added or changed — every other file from baseSourceRevision is carried over unchanged."),
          deletedFiles: z.array(z.string()).optional().describe("File paths to remove from the base source entirely."),
          envVars: z.record(z.string(), z.string()).optional().describe("Extra env vars for this deploy, same as deploy_to_sacms."),
          runId: z.string().optional().describe("The runId from start_website_build, if you have one for this request."),
          idempotencyKey: z.string().optional().describe("A key unique to THIS submission. If this tool's response is ever lost, retry with the SAME key to get back the already-completed deployment instead of patching twice."),
        },
        outputSchema: {
          ok: z.boolean(),
          code: z.string().optional(),
          deploymentId: z.string().optional(),
          sourceRevision: z.string().optional(),
          productionUrl: z.string().optional(),
          deploymentUrl: z.string().optional(),
          promoted: z.boolean().optional(),
          changedCount: z.number().optional(),
          deletedCount: z.number().optional(),
          unchangedCount: z.number().optional(),
          state: z.string().optional(),
          issues: z.array(z.string()).optional(),
          retryAfterSeconds: z.number().optional(),
          message: z.string(),
        },
      },
      async ({ baseSourceRevision, changedFiles, deletedFiles, envVars, runId, idempotencyKey }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{ type: "text" as const, text: `❌ Payment Required: Fitur deploy SaCMS Cloud Hosting memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions` }],
            isError: true,
          }
        }

        const base = await getDeploymentSourceByRevision(auth.tenantId, baseSourceRevision)
        if (!base) {
          return {
            content: [{ type: "text" as const, text: `❌ baseSourceRevision '${baseSourceRevision}' tidak ditemukan untuk workspace ini — mungkin sudah terlalu lama (hanya revisi terbaru yang disimpan), atau belum pernah diimpor. Panggil get_deployment_source untuk mendapatkan sourceRevision terbaru (membaca source akan otomatis mengimpornya kalau belum tersimpan).` }],
            structuredContent: { ok: false, code: "SOURCE_IMPORT_REQUIRED", message: "baseSourceRevision not found." },
            isError: true,
          }
        }

        // Never patch onto a base that fails the same validation import
        // applies (chatgpt3.md) — a revision persisted before the
        // path-normalization/signature fix can carry either bug, and
        // merging changedFiles onto it would just redeploy the corruption
        // under a new sourceRevision instead of fixing it.
        const baseIssues = findSourceIssues(base.files)
        if (baseIssues.length > 0) {
          return {
            content: [{ type: "text" as const, text: `❌ baseSourceRevision '${baseSourceRevision}' gagal validasi (${baseIssues.join(", ")}) — kemungkinan diimpor sebelum perbaikan normalisasi path/validasi aset biner. Panggil get_deployment_source TANPA paths untuk mendapatkan sourceRevision baru yang sudah divalidasi/diperbaiki, lalu gunakan itu sebagai baseSourceRevision.` }],
            structuredContent: { ok: false, code: "SOURCE_CORRUPTED", issues: baseIssues, message: "This stored source revision failed validation — re-import before patching." },
            isError: true,
          }
        }

        const latest = await getLatestDeploymentSource(auth.tenantId)
        if (latest && latest.id !== baseSourceRevision) {
          return {
            content: [{
              type: "text" as const,
              text: `⚠️ Conflict: Source aktif workspace ini sudah berubah sejak baseSourceRevision '${baseSourceRevision}' dibaca — revisi terbaru sekarang adalah '${latest.id}'. Panggil get_deployment_source lagi untuk melihat source terbaru sebelum mengirim patch ini lagi, supaya tidak menimpa perubahan yang belum kamu lihat.`
            }],
            structuredContent: { ok: false, code: "CONFLICT", sourceRevision: latest.id, message: "Base source is stale — a newer deployment exists." },
            isError: true,
          }
        }

        // Idempotency check — before the rate limit, same reasoning as deploy_to_sacms.
        const idem = await resolveIdempotency(auth, idempotencyKey, "update")
        if (idem.kind === "in_progress") {
          return {
            content: [{ type: "text" as const, text: `⏳ Patch dengan idempotencyKey ini masih berjalan (runId: ${idem.run.id}) — jangan kirim ulang, cek get_build_run atau tunggu sebentar.` }],
            structuredContent: { ok: false, code: "DEPLOY_IN_PROGRESS", message: "A patch with this idempotencyKey is already in progress." },
            isError: true,
          }
        }
        if (idem.kind === "replay") {
          const structured = {
            ok: true,
            deploymentId: idem.run.deploymentId || undefined,
            sourceRevision: idem.run.sourceRevision || undefined,
            productionUrl: idem.status?.productionUrl || undefined,
            deploymentUrl: idem.status?.deploymentUrl || undefined,
            state: idem.status?.state || "UNKNOWN",
            message: "Idempotent replay: this idempotencyKey already completed a patch deploy — returning that result instead of patching again.",
          }
          return {
            content: [{ type: "text" as const, text: `🔁 Replay idempoten — deployment ${structured.deploymentId} sudah ada untuk idempotencyKey ini.` }],
            structuredContent: structured,
          }
        }
        const effectiveRunId = runId || idem.effectiveRunId

        const deployLimit = await rateLimit(`mcp_deploy:${auth.tenantId}`, { limit: 3, windowSeconds: 300 })
        if (!deployLimit.success) {
          // Same reasoning as deploy_to_sacms's identical block — release
          // the idempotency claim so a same-key retry isn't wrongly read
          // as still in progress (chatgpt3.md).
          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, { stage: "failed", lastError: "RATE_LIMITED" })
          }
          const retryAfterSeconds = Math.max(1, Math.ceil((deployLimit.resetAt - Date.now()) / 1000))
          return {
            content: [{ type: "text" as const, text: `❌ Terlalu banyak percobaan deploy. Maksimal 3 deploy per 5 menit per workspace — coba lagi dalam ${retryAfterSeconds} detik, dengan idempotencyKey yang SAMA kalau kamu memberikan satu.` }],
            structuredContent: { ok: false, code: "RATE_LIMITED", retryAfterSeconds, message: "Too many deploy submissions in this window." },
            isError: true,
          }
        }

        try {
          // Normalize the carried-over base files' encoding too — a row
          // persisted before this fix (or by a caller that omitted
          // encoding on an unchanged file) could still have `undefined`
          // sitting there, which fails files[].encoding's required enum
          // on the next read-back.
          const fileMap = new Map(base.files.map((f) => [f.name, { ...f, encoding: f.encoding || ("utf-8" as const) }] as const))
          for (const f of changedFiles) {
            fileMap.set(f.name, { name: f.name, content: f.content, encoding: f.encoding || "utf-8" })
          }
          for (const path of deletedFiles || []) {
            fileMap.delete(path)
          }
          const mergedFiles = Array.from(fileMap.values())

          const { resolveFrontendEnv, pushEnvToVercelProject, resolveApiOrigin } = await import(
            "@/lib/infrastructure/frontend-env"
          )
          const resolvedEnv = await resolveFrontendEnv(auth.tenantId, auth.tenantSlug, resolveApiOrigin())
          const mergedEnv: Record<string, string> = { ...(envVars as Record<string, string> | undefined), ...resolvedEnv }

          const lockedProjectName = `sacms-${auth.tenantSlug}`
          // Staging candidate, same reasoning as deploy_to_sacms — nothing
          // a visitor sees changes until promote_deployment is called.
          const subdomainLabel = await resolveSubdomainLabel(auth.tenantId, auth.tenantSlug)
          const result = await deployToVercel(lockedProjectName, mergedFiles, mergedEnv, subdomainLabel, "staging")

          if (result.projectId && !result.simulated) {
            pushEnvToVercelProject(result.projectId, mergedEnv).catch((e) =>
              console.warn("[MCP deploy_website_patch] env push failed:", e),
            )
          }

          if (result.projectId) {
            await db.tenant.update({
              where: { id: auth.tenantId },
              data: { vercelProjectId: result.projectId },
            }).catch((e) => console.warn("[MCP deploy_website_patch] Failed to persist project id:", e))
          }

          // Re-check immediately before persisting — narrows (does not
          // eliminate) the race where a second concurrent patch against the
          // same baseSourceRevision slips in while THIS deploy was running
          // against Vercel (the dominant real-world collision window,
          // since that call takes seconds — the gap before it is much
          // shorter). The Vercel deploy itself already happened and can't
          // be undone at this point, so this can only warn, not prevent it.
          const stillLatest = await getLatestDeploymentSource(auth.tenantId)
          const concurrentChangeDetected = !!stillLatest && stillLatest.id !== baseSourceRevision

          let sourceRevision: string | undefined
          try {
            const saved = await saveDeploymentSource(auth.tenantId, result.id, result.projectId, mergedFiles as DeploymentSourceFile[], await activeSchema(auth.tenantId, auth.tenantSlug).catch(() => undefined))
            sourceRevision = saved.id
          } catch (e) {
            console.warn("[MCP deploy_website_patch] Failed to persist source snapshot:", e)
          }

          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, {
              stage: "staged",
              deploymentId: result.id,
              sourceRevision: sourceRevision || result.id,
              hostingProjectId: result.projectId || undefined,
              lastError: null,
            })
          }

          const structured = {
            ok: true,
            code: concurrentChangeDetected ? "CONCURRENT_CHANGE_DURING_DEPLOY" : "AWAITING_PROMOTION",
            deploymentId: result.id,
            sourceRevision,
            // Deliberately the candidate's own URL, not the live domain —
            // see deploy_to_sacms's identical note.
            productionUrl: result.url,
            deploymentUrl: result.deploymentUrl,
            promoted: false,
            changedCount: changedFiles.length,
            deletedCount: (deletedFiles || []).length,
            unchangedCount: mergedFiles.length - changedFiles.length,
            state: result.state,
            message: concurrentChangeDetected
              ? "This staging deploy succeeded, but another deploy happened WHILE it was running against a DIFFERENT base — call get_deployment_source to check the current state before patching again or promoting."
              : "Staging ready for review. Release from Infrastructure → Hosting.",
          }
          return {
            content: [{ type: "text" as const, text: `🚧 Patch Deploy ke STAGING Sukses (belum live)!\n- Deployment ID: ${result.id}\n- sourceRevision: ${sourceRevision}\n- Staging URL: ${result.deploymentUrl || result.url}\n- File diubah: ${changedFiles.length}, dihapus: ${(deletedFiles || []).length}, tidak berubah: ${structured.unchangedCount}${concurrentChangeDetected ? "\n⚠️ Perubahan bersamaan terdeteksi selama deploy ini — cek get_deployment_source." : "\n\nRilis melalui Infrastruktur → Hosting."}` }],
            structuredContent: structured,
          }
        } catch (err: any) {
          if (effectiveRunId) {
            advanceBuildRun(auth.tenantId, effectiveRunId, { stage: "failed", lastError: err.message })
          }
          return {
            content: [{ type: "text" as const, text: `❌ Gagal deploy patch: ${err.message}` }],
            structuredContent: { ok: false, code: "DEPLOYMENT_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── promote_deployment ───────────────────────────────────────────────────
    server.registerTool(
      "promote_deployment",
      {
        title: "Open Production Hosting",
        description: "Production release requires an administrator to click Deploy Production in Infrastructure → Hosting.",
        inputSchema: { deploymentId: z.string().optional() },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const hostingUrl = resolveApiOrigin() + "/dashboard/" + encodeURIComponent(auth.tenantSlug) + "/infrastructure?tab=hosting"
        return { structuredContent: { code: "DASHBOARD_REQUIRED", hostingUrl }, content: [{ type: "text" as const, text: "Rilis production melalui " + hostingUrl }] }
      },
    )

    server.registerTool(
      "get_deployment_runtime_logs",
      {
        title: "Get Deployment Runtime Logs (Request/Response Activity)",
        description: "Read a deployment's RUNTIME logs — actual request/response activity from serving traffic — to diagnose an HTTP 500 (or any other bad status) a real request hit. This is a DIFFERENT API from get_deployment_build_logs: a build reporting READY says nothing about runtime behavior (that's exactly how a rich-text patch once reached HTTP 500 in production despite a READY build). Call this on a CANDIDATE's deploymentId right after promote_deployment reports CHECKS_FAILED, or on a live deploymentId if something's wrong in production. Reads for a few seconds and returns whatever arrived — `truncated: true` means there may be more than what's shown; narrow with errorLines first.",
        inputSchema: {
          deploymentId: z.string().optional().describe("Specific deployment to read runtime logs from. Omit to use the latest production deployment for this workspace."),
        },
        outputSchema: {
          deploymentId: z.string(),
          lines: z.array(z.object({
            level: z.string(),
            message: z.string(),
            requestMethod: z.string().optional(),
            requestPath: z.string().optional(),
            responseStatusCode: z.number().optional(),
            source: z.string().optional(),
            timestampInMs: z.number().optional(),
          })),
          errorLines: z.array(z.object({
            level: z.string(),
            message: z.string(),
            requestMethod: z.string().optional(),
            requestPath: z.string().optional(),
            responseStatusCode: z.number().optional(),
            source: z.string().optional(),
            timestampInMs: z.number().optional(),
          })),
          truncated: z.boolean(),
        },
      },
      async ({ deploymentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const resolved = await resolveDeploymentId(auth, deploymentId)
          if (!resolved.ok) return resolved.response
          const projectId = resolved.status?.projectId
          if (!projectId) {
            return {
              content: [{ type: "text" as const, text: `❌ Tidak bisa menemukan project untuk deployment '${resolved.id}'.` }],
              structuredContent: { ok: false, code: "NOT_FOUND", message: "Project could not be resolved for this deployment." },
              isError: true,
            }
          }

          const { lines, errorLines, truncated } = await getRuntimeLogs(projectId, resolved.id)
          const structured = { deploymentId: resolved.id, lines, errorLines, truncated }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal mengambil runtime log: ${err.message}` }],
            structuredContent: { ok: false, code: "VERIFICATION_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── list_website_versions ────────────────────────────────────────────────
    server.registerTool(
      "list_website_versions",
      {
        title: "List Recent Deployed Source Versions",
        description: "List this workspace's recent deploy_to_sacms/deploy_website_patch/rollback_website snapshots (most recent first) — each sourceRevision can be passed to get_deployment_source (as deploymentId won't work for this) or rollback_website. Only a rolling window of recent revisions is kept, not a permanent history.",
        inputSchema: {
          limit: z.number().int().min(1).max(20).optional().describe("Max versions to return, default 10."),
        },
        outputSchema: {
          versions: z.array(z.object({
            sourceRevision: z.string(),
            deploymentId: z.string(),
            fileCount: z.number(),
            createdAt: z.string(),
          })),
        },
      },
      async ({ limit }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const rows = await listDeploymentSources(auth.tenantId, limit ?? 10)
        const structured = {
          versions: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      }
    )

    // ── rollback_website ─────────────────────────────────────────────────────
    server.registerTool(
      "rollback_website",
      {
        title: "Rollback to a Previous Deployed Version",
        description: "Redeploy a previous sourceRevision's exact files (from list_website_versions) — use this when a revision broke something and the user wants to go back, instead of trying to manually reconstruct the old state. This creates a NEW deployment (and a new sourceRevision) with the old content, it does not delete what's live now.",
        inputSchema: {
          dryRun: z.boolean().optional().describe("Inspect compatibility before restoring to staging."),
          sourceRevision: z.string().describe("The sourceRevision to restore, from list_website_versions."),
          runId: z.string().optional(),
        },
        outputSchema: {
          ok: z.boolean(),
          code: z.string().optional(),
          deploymentId: z.string().optional(),
          sourceRevision: z.string().optional(),
          productionUrl: z.string().optional(),
          deploymentUrl: z.string().optional(),
          state: z.string().optional(),
          schemaCompatibility: z.record(z.string(), z.unknown()).optional(),
          issues: z.array(z.string()).optional(),
          retryAfterSeconds: z.number().optional(),
          message: z.string(),
        },
      },
      async ({ sourceRevision, runId, dryRun }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{ type: "text" as const, text: `❌ Payment Required: Fitur deploy SaCMS Cloud Hosting memerlukan workspace berstatus PAID.` }],
            isError: true,
          }
        }

        const target = await getDeploymentSourceByRevision(auth.tenantId, sourceRevision)
        if (!target) {
          return {
            content: [{ type: "text" as const, text: `❌ sourceRevision '${sourceRevision}' tidak ditemukan untuk workspace ini — cek list_website_versions untuk revisi yang tersedia.` }],
            structuredContent: { ok: false, code: "NOT_FOUND", message: "sourceRevision not found." },
            isError: true,
          }
        }

        // Rolling back to a corrupted revision would just redeploy the
        // same bug (chatgpt3.md) — same validation import/patch apply.
        const targetIssues = findSourceIssues(target.files)
        if (targetIssues.length > 0) {
          return {
            content: [{ type: "text" as const, text: `❌ sourceRevision '${sourceRevision}' gagal validasi (${targetIssues.join(", ")}) — rollback ke revisi ini akan mereproduksi masalah yang sama. Pilih revisi lain dari list_website_versions, atau panggil get_deployment_source dulu untuk mendapatkan revisi yang sudah tervalidasi.` }],
            structuredContent: { ok: false, code: "SOURCE_CORRUPTED", issues: targetIssues, message: "This source revision failed validation." },
            isError: true,
          }
        }

        const schemaCompatibility = compareSchema(target.schemaSnapshot, await activeSchema(auth.tenantId, auth.tenantSlug))
        if (dryRun) {
          const structured = { ok: true, sourceRevision, schemaCompatibility, message: "Compatibility review only." }
          return { structuredContent: structured, content: [{ type: "text" as const, text: JSON.stringify(structured) }] }
        }
        const deployLimit = await rateLimit(`mcp_deploy:${auth.tenantId}`, { limit: 3, windowSeconds: 300 })
        if (!deployLimit.success) {
          const retryAfterSeconds = Math.max(1, Math.ceil((deployLimit.resetAt - Date.now()) / 1000))
          return {
            content: [{ type: "text" as const, text: `❌ Terlalu banyak percobaan deploy. Maksimal 3 deploy per 5 menit per workspace — coba lagi dalam ${retryAfterSeconds} detik.` }],
            structuredContent: { ok: false, code: "RATE_LIMITED", retryAfterSeconds, message: "Too many deploy submissions in this window." },
            isError: true,
          }
        }

        try {
          // Same encoding normalization as deploy_to_sacms/deploy_website_patch
          // — a revision persisted before that fix could still carry an
          // undefined encoding forward into this new rollback snapshot.
          const normalizedTargetFiles = target.files.map((f) => ({ ...f, encoding: f.encoding || ("utf-8" as const) }))

          const { resolveFrontendEnv, pushEnvToVercelProject, resolveApiOrigin } = await import(
            "@/lib/infrastructure/frontend-env"
          )
          const resolvedEnv = await resolveFrontendEnv(auth.tenantId, auth.tenantSlug, resolveApiOrigin())
          const lockedProjectName = `sacms-${auth.tenantSlug}`
          // Explicit "production" — unlike deploy_to_sacms/deploy_website_patch,
          // rollback is the emergency-recovery path (go back to known-good
          // NOW); gating it behind an extra staging+promote cycle would
          // defeat its whole purpose.
          const subdomainLabel = await resolveSubdomainLabel(auth.tenantId, auth.tenantSlug)
          const result = await deployToVercel(lockedProjectName, normalizedTargetFiles, resolvedEnv, subdomainLabel, "staging")

          if (result.projectId && !result.simulated) {
            pushEnvToVercelProject(result.projectId, resolvedEnv).catch((e) =>
              console.warn("[MCP rollback_website] env push failed:", e),
            )
          }
          if (result.url) {
            await db.tenant.update({
              where: { id: auth.tenantId },
              data: { vercelProjectId: result.projectId || undefined },
            }).catch((e) => console.warn("[MCP rollback_website] Failed to persist deployment:", e))
          }

          let newSourceRevision: string | undefined
          try {
            const saved = await saveDeploymentSource(auth.tenantId, result.id, result.projectId, normalizedTargetFiles, target.schemaSnapshot as object | undefined)
            newSourceRevision = saved.id
          } catch (e) {
            console.warn("[MCP rollback_website] Failed to persist source snapshot:", e)
          }

          if (runId) {
            advanceBuildRun(auth.tenantId, runId, {
              stage: "deploying",
              deploymentId: result.id,
              sourceRevision: newSourceRevision || result.id,
              hostingProjectId: result.projectId || undefined,
            })
          }

          const structured = {
            ok: true,
            schemaCompatibility,
            deploymentId: result.id,
            sourceRevision: newSourceRevision,
            productionUrl: result.url,
            deploymentUrl: result.deploymentUrl,
            state: result.state,
            message: "Rollback dideploy sebagai revisi baru. Call get_deployment_status lalu verify_deployment_url sebelum melapor sukses ke pengguna.",
          }
          return {
            content: [{ type: "text" as const, text: `🚀 Rollback ke ${sourceRevision} sukses sebagai deployment baru ${result.id}.\n- Live URL: ${result.url}` }],
            structuredContent: structured,
          }
        } catch (err: any) {
          if (runId) {
            advanceBuildRun(auth.tenantId, runId, { stage: "failed", lastError: err.message })
          }
          return {
            content: [{ type: "text" as const, text: `❌ Gagal rollback: ${err.message}` }],
            structuredContent: { ok: false, code: "DEPLOYMENT_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── get_deployment_status ────────────────────────────────────────────────
    server.registerTool(
      "get_deployment_status",
      {
        title: "Get Deployment Status",
        description: "Check the build progress and ready state of a SaCMS Cloud Hosting deployment. Returns two DISTINCT urls — productionUrl (the project's real public domain: custom domain or *.vercel.app alias; this is the one safe to hand a visitor) and deploymentUrl (this specific build's own immutable hostname, which Vercel's deployment protection gates by default and a real visitor usually can't open). Omit deploymentId to automatically check the latest production deployment for this workspace — use that whenever you don't have a specific id handy (e.g. a previous deploy_to_sacms response never arrived), instead of re-deploying just to get a fresh id.",
        inputSchema: {
          deploymentId: z.string().optional().describe("Specific Deployment ID (e.g. 'dpl_xxx'). Omit to auto-resolve this workspace's latest production deployment."),
        },
        outputSchema: {
          deploymentId: z.string(),
          sourceVersion: z.string().nullable().optional(),
          state: z.string(),
          productionUrl: z.string().nullable(),
          deploymentUrl: z.string(),
          isReady: z.boolean(),
        },
      },
      async ({ deploymentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const resolved = await resolveDeploymentId(auth, deploymentId)
          if (!resolved.ok) return resolved.response
          const status = resolved.status!

          const released = await db.setting.findUnique({ where: { key: auth.tenantId + "_productionSource_" + resolved.id }, select: { value: true } })
          const snapshot = released ? null : await getDeploymentSourceByDeploymentId(auth.tenantId, resolved.id)
          const structured = {
            sourceVersion: released?.value ?? snapshot?.id ?? null,
            deploymentId: resolved.id,
            state: status.state,
            productionUrl: status.productionUrl,
            deploymentUrl: status.deploymentUrl,
            isReady: status.state === "READY",
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Error memeriksa status deployment: ${err.message}`
            }],
            structuredContent: { ok: false, code: "VERIFICATION_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── get_deployment_source ────────────────────────────────────────────────
    server.registerTool(
      "get_content_preview_url",
      {
        title: "Preview Saved CMS Content",
        description: "Open the current saved CMS fields, including drafts, in the authenticated workspace dashboard. For an entry, pass its ID. For a single type, pass its slug and locale.",
        inputSchema: { kind: z.enum(["entry", "single"]), id: z.string().min(1), locale: z.string().default("id") },
      },
      async ({ kind, id, locale }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")
        const tenantDb = await getTenantDb(auth.tenantSlug)
        const record = kind === "entry"
          ? await tenantDb.contentEntry.findFirst({ where: { id, tenantId: auth.tenantId, deletedAt: null }, select: { status: true } })
          : await tenantDb.tenantSingleTypeAssignment.findFirst({ where: { tenantId: auth.tenantId, locale, enabled: true, singleType: { slug: id, draftTemplateId: null } }, select: { draftData: true, publishedAt: true } })
        if (!record) return { isError: true, content: [{ type: "text" as const, text: "Content not found in this workspace" }] }
        const hasDraft = "status" in record ? record.status !== "PUBLISHED" : record.draftData != null || !record.publishedAt
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const url = new URL(resolveApiOrigin())
        url.pathname = "/dashboard/" + encodeURIComponent(auth.tenantSlug) + "/cms/preview/" + kind + "/" + encodeURIComponent(id)
        url.searchParams.set("locale", locale)
        return { structuredContent: { previewUrl: url.href, previewKind: "content", contentMode: hasDraft ? "draft" : "published", access: "workspace-session" }, content: [{ type: "text" as const, text: url.href }] }
      },
    )
    server.registerTool(
      "get_site_source",
      {
        title: "Get Saved Workspace Site Source",
        description: "Read the latest saved source snapshot or a specific sourceVersion. The workspace is selected by the MCP token. For a deployment without a snapshot, call get_deployment_source to import it.",
        inputSchema: {
          siteId: z.string().optional().describe("Workspace hosting project ID. Omit for the default website."),
          sourceVersion: z.string().optional(),
        },
      },
      async ({ siteId, sourceVersion }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")
        const site = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { vercelProjectId: true } })
        if (!site || (siteId && site.vercelProjectId !== siteId)) {
          return { isError: true, content: [{ type: "text" as const, text: "Site not found in this workspace" }] }
        }
        const snapshot = sourceVersion
          ? await getDeploymentSourceByRevision(auth.tenantId, sourceVersion)
          : await getLatestDeploymentSource(auth.tenantId)
        if (!snapshot || (siteId && snapshot.projectId && snapshot.projectId !== siteId)) {
          return { isError: true, content: [{ type: "text" as const, text: "Source version not found for this site" }] }
        }
        const structured = { siteId: site.vercelProjectId, sourceVersion: snapshot.id, files: snapshot.files }
        return { structuredContent: structured, content: [{ type: "text" as const, text: JSON.stringify(structured) }] }
      },
    )
    server.registerTool(
      "get_deployment_source",
      {
        title: "Get Current Deployed Source Files",
        description: "Read back the actual files from this workspace's SaCMS Cloud Hosting deployment — call this BEFORE making a targeted revision (\"ubah warna header\", \"kecilkan logo\") whenever you don't already have the current source in this conversation, instead of regenerating the whole frontend from scratch or guessing what's there. Returns files in the same {name, content, encoding} shape deploy_to_sacms expects (encoding \"base64\" for binary assets like PNG icons — pass it straight back when redeploying), plus a sha256 checksum per file (of its real bytes, not of base64 text) and a sourceRevision you can pass to deploy_website_patch as baseSourceRevision. Prefers SaCMS's own persisted snapshot of the deploy (exact byte-for-byte, lockfiles included) over re-reading Vercel's files API — but a persisted snapshot is re-validated every time (wrapper-directory paths, corrupted binary assets) before being trusted; a snapshot that fails falls through to a fresh live re-import automatically (the old one is kept for history, not deleted) and the result comes back with `code: \"SOURCE_REPAIRED\"`. If no persisted snapshot exists yet (a deployment made before this feature existed, or outside deploy_to_sacms entirely) and you asked for the FULL project (no `paths`), a complete AND validated read is automatically imported into SaCMS's own history so you get back a real sourceRevision usable with deploy_website_patch immediately — a second import of the same deployment reuses that same sourceRevision rather than creating a duplicate. If the read came back incomplete (truncated, or files skipped), no import happens and `code: \"SOURCE_INCOMPLETE\"` is returned; if it came back complete but a binary asset failed its own format's signature check, no import happens and `code: \"SOURCE_INVALID\"` is returned with the bad paths in `invalidAssets` — in either case raise maxFiles, ask about the skipped paths, or regenerate the broken asset before relying on this as a patch base. Pass paths to fetch only specific files (cheaper than the full set when you already know what you need — never triggers an import/repair, since it's a deliberately partial read; if the persisted snapshot needed repair, this returns `code: \"SOURCE_NEEDS_REIMPORT\"` instead of silently serving known-bad paths), or manifestOnly: true to see just the file list/sizes/checksums with no content at all. Any path you asked for that doesn't exist comes back in `missingPaths`. Omit deploymentId to read the latest production deployment.",
        inputSchema: {
          deploymentId: z.string().optional().describe("Specific deployment to read from. Omit to use the latest production deployment for this workspace."),
          maxFiles: z.number().int().min(1).max(200).optional().describe("Safety cap on how many files to return (default 100) when reading the full set. Ignored when paths is given."),
          paths: z.array(z.string()).optional().describe("Return only these file paths instead of the whole project — cheaper when you already know which files you need to re-edit. Any path not found comes back in missingPaths. Never triggers an auto-import (deliberately partial)."),
          manifestOnly: z.boolean().optional().describe("Return just name/size/encoding/checksum for every file, with content left empty — use this first to see what's there before deciding which files to actually fetch."),
          runId: z.string().optional().describe("The runId from start_website_build, if you have one — updates its recorded sourceRevision when this call establishes or confirms one."),
        },
        outputSchema: {
          deploymentId: z.string(),
          sourceRevision: z.string().optional(),
          source: z.enum(["persisted", "vercel-live"]),
          files: z.array(z.object({ name: z.string(), content: z.string(), encoding: z.enum(["utf-8", "base64"]), size: z.number(), checksum: z.string() })),
          skipped: z.array(z.string()),
          truncated: z.boolean(),
          invalidAssets: z.array(z.string()),
          missingPaths: z.array(z.string()),
          code: z.string().optional(),
        },
      },
      async ({ deploymentId, maxFiles, paths, manifestOnly, runId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const resolved = await resolveDeploymentId(auth, deploymentId)
          if (!resolved.ok) return resolved.response

          // Prefer SaCMS's own persisted snapshot (exact bytes, lockfiles
          // included) over re-deriving it from Vercel's files API — only a
          // deployment made before this feature existed, or outside
          // deploy_to_sacms entirely, falls through to the live read. But
          // a snapshot persisted before the path-normalization/signature
          // fix (chatgpt3.md) can itself carry either bug — never trust it
          // at face value; a snapshot that fails re-validation is treated
          // as if none existed, so the code below repairs it via a fresh
          // live read. The old row is left exactly as it was, for history.
          const persistedRaw = deploymentId
            ? await getDeploymentSourceByDeploymentId(auth.tenantId, resolved.id)
            : await getLatestDeploymentSource(auth.tenantId)
          const persisted = persistedRaw && findSourceIssues(persistedRaw.files).length === 0 ? persistedRaw : null
          const persistedNeedsRepair = !!persistedRaw && !persisted

          let files: { name: string; content: string; encoding: "utf-8" | "base64"; size: number; checksum: string }[]
          let skipped: string[] = []
          let truncated = false
          let invalidAssets: string[] = []
          let source: "persisted" | "vercel-live"
          let sourceRevision: string | undefined
          let code: string | undefined

          if (persisted) {
            source = "persisted"
            sourceRevision = persisted.id
            const manifestByPath = new Map(persisted.manifest.map((m) => [m.path, m]))
            const base = paths ? persisted.files.filter((f) => paths.includes(f.name)) : persisted.files
            files = base.map((f) => ({
              name: f.name,
              content: manifestOnly ? "" : f.content,
              // A row persisted before encoding was normalized at write-time
              // could still have it undefined — default it here too so this
              // never fails the outputSchema's required encoding enum on
              // read-back of an old revision.
              encoding: f.encoding || "utf-8",
              size: manifestByPath.get(f.name)?.size ?? f.content.length,
              checksum: manifestByPath.get(f.name)?.checksum ?? "",
            }))
          } else {
            source = "vercel-live"
            const live = await getDeploymentFiles(resolved.id, maxFiles ?? 100)
            const base = paths ? live.files.filter((f) => paths.includes(f.name)) : live.files
            files = base.map((f) => ({ ...f, content: manifestOnly ? "" : f.content }))
            skipped = live.skipped
            truncated = live.truncated
            invalidAssets = live.invalidAssets

            // Auto-import: a deployment-made-before-this-feature (or made
            // outside deploy_to_sacms entirely), or a persisted snapshot
            // that just failed re-validation above, has no TRUSTWORTHY
            // persisted source — without this, get_deployment_source could
            // read it but deploy_website_patch would have no
            // baseSourceRevision to work from, exactly the gap that
            // blocked a patch from a fresh conversation (chatgpt2.md).
            // Only import on a deliberate full-project read (no `paths`)
            // that came back complete AND passed its own validation —
            // persisting a truncated/partially-skipped/corrupted read as
            // "the full source" would just reproduce the same bug under a
            // new sourceRevision.
            if (!paths) {
              if (!truncated && skipped.length === 0 && invalidAssets.length === 0) {
                try {
                  const saved = await saveDeploymentSource(auth.tenantId, resolved.id, resolved.status?.projectId, live.files)
                  sourceRevision = saved.id
                  if (persistedNeedsRepair) code = "SOURCE_REPAIRED"
                  if (runId) advanceBuildRun(auth.tenantId, runId, { sourceRevision: saved.id })
                } catch (e) {
                  console.warn("[MCP get_deployment_source] Failed to auto-import live read into source history:", e)
                }
              } else {
                code = invalidAssets.length > 0 ? "SOURCE_INVALID" : "SOURCE_INCOMPLETE"
              }
            } else if (persistedNeedsRepair) {
              // A paths-scoped read never triggers import/repair — surface
              // WHY the known-bad persisted snapshot was bypassed instead
              // of silently serving a live read with no sourceRevision.
              code = "SOURCE_NEEDS_REIMPORT"
            }
          }

          const missingPaths = paths ? paths.filter((p) => !files.some((f) => f.name === p)) : []
          const structured = { deploymentId: resolved.id, sourceRevision, source, files, skipped, truncated, invalidAssets, missingPaths, code }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal membaca source deployment: ${err.message}` }],
            structuredContent: { ok: false, code: "VERIFICATION_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── get_deployment_build_logs ────────────────────────────────────────────
    server.registerTool(
      "get_deployment_build_logs",
      {
        title: "Get Deployment Build Logs",
        description: "Read the build log output of a SaCMS Cloud Hosting deployment — call this when get_deployment_status reports an errored/failed build, to see WHY it failed (compiler error, missing dependency, etc.) before fixing the source and calling deploy_to_sacms again. Omit deploymentId to read the latest production deployment's logs.",
        inputSchema: {
          deploymentId: z.string().optional().describe("Specific deployment to read logs from. Omit to use the latest production deployment for this workspace."),
        },
        outputSchema: {
          deploymentId: z.string(),
          lines: z.array(z.string()),
          errorLines: z.array(z.string()),
        },
      },
      async ({ deploymentId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const resolved = await resolveDeploymentId(auth, deploymentId)
          if (!resolved.ok) return resolved.response

          const { lines, errorLines } = await getDeploymentBuildLogs(resolved.id)
          const structured = { deploymentId: resolved.id, lines, errorLines }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal membaca build log: ${err.message}` }],
            structuredContent: { ok: false, code: "BUILD_FAILED", message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── verify_deployment_url ────────────────────────────────────────────────
    server.registerTool(
      "verify_deployment_url",
      {
        title: "Verify the Live Deployment Actually Works",
        description: "Fetch this workspace's live deployed site over HTTP to confirm it actually opens and renders real content — call this AFTER get_deployment_status reports READY, before telling the user the website is done. Never report success just because deploy_to_sacms was accepted or Vercel says the build is ready — a ready build can still serve a login wall, an error page, or empty/fallback content instead of real data, AND the production domain can still be serving an OLDER deployment if Vercel hasn't finished promoting the new one. Pass deploymentId (or a runId that has one recorded) to bind this check to that SPECIFIC build — if the production domain isn't actually serving it yet, this returns PRODUCTION_VERSION_MISMATCH instead of a false pass. For a multi-page build (home + detail + feed + a PWA manifest, etc.), pass multiple checks and ALL of them must pass before this marks the runId done — a homepage-only check must not report the whole build verified. Pass expectedText per check (e.g. a real article title you already got from query_content) to confirm specific content rendered, not just that the page returned 200. For a binary asset (a PWA icon, a favicon) a plain HTTP 200 can still be a corrupted file — pass expectedSignature (\"png\"/\"jpeg\"/\"gif\"/\"ico\") to confirm its bytes match that format's own magic number, expectedChecksum (sha256 hex of the real bytes you deployed, from deploy_to_sacms/get_deployment_source) for an exact match, and/or expectedContentType to check the response header. KNOWN LIMITATION: only HTTP-level checks are performed here (status + HTML substring + binary signature/checksum) — this cannot render in a real browser or confirm a PWA actually installs on a device; say so explicitly if the user asked for either of those rather than claiming they were checked.",
        inputSchema: {
          paths: previewRoutePaths.optional(),
          path: z.string().optional().describe("Shorthand for a single check: path on this workspace's own live deployment domain, e.g. \"/\" (default) or \"/artikel/contoh-slug\". Ignored if checks is provided."),
          expectedText: z.string().optional().describe("Shorthand for a single check's expectedText. Ignored if checks is provided."),
          checks: z.array(z.object({
            path: z.string().describe("Path to check, e.g. \"/\", \"/artikel/contoh-slug\", \"/feed.xml\", \"/manifest.json\", \"/icon-192.png\"."),
            expectedText: z.string().optional().describe("A substring expected in that path's rendered HTML/body."),
            expectedContentType: z.string().optional().describe("Substring expected in the response's Content-Type header, e.g. \"image/png\"."),
            expectedSignature: z.enum(["png", "jpeg", "gif", "ico"]).optional().describe("Confirms the response body's raw bytes start with this format's own magic number — catches a binary asset that returns HTTP 200 but isn't actually valid image data (chatgpt3.md)."),
            expectedChecksum: z.string().optional().describe("sha256 hex of the exact bytes expected (from deploy_to_sacms/get_deployment_source's checksum for that file) — the strictest check, confirms byte-for-byte."),
          })).max(10).optional().describe("One or more required checks — e.g. home, a detail page, a content feed, and a PWA manifest/icon. ALL must pass for runId to be marked done. Never pass a full URL to a different host — every check is against THIS workspace's own deployment."),
          deploymentId: z.string().optional().describe("Bind this verification to a SPECIFIC deployment — fails with PRODUCTION_VERSION_MISMATCH if the production domain isn't actually serving it yet. Defaults to the runId's recorded deploymentId if omitted, else no binding (just checks whatever's currently live)."),
          runId: z.string().optional().describe("The runId from start_website_build, if you called it for this request — marks that run done only once every check (and the deployment binding, if any) passes, or failed/verifying with the reason."),
        },
        outputSchema: {
          ok: z.boolean(),
          code: z.string().optional(),
          verifiedDeploymentId: z.string().optional(),
          checks: z.array(z.object({
            deploymentId: z.string().nullable(),
            sourceVersion: z.string().nullable(),
            path: z.string(),
            url: z.string(),
            status: z.number(),
            ok: z.boolean(),
            htmlLength: z.number(),
            containsExpectedText: z.boolean().optional(),
            looksLikeErrorPage: z.boolean(),
            contentType: z.string().optional(),
            contentTypeOk: z.boolean().optional(),
            signatureOk: z.boolean().optional(),
            checksumOk: z.boolean().optional(),
          })),
          // Back-compat mirror of checks[0], for callers using the old single-check shape.
          url: z.string(),
          status: z.number(),
          htmlLength: z.number(),
          containsExpectedText: z.boolean().optional(),
          looksLikeErrorPage: z.boolean(),
        },
      },
      async ({ path, paths, expectedText, checks, deploymentId, runId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        try {
          const tenant = await db.tenant.findUnique({ where: { id: auth.tenantId }, select: { vercelDeploymentUrl: true, vercelProjectId: true } })
          if (!tenant?.vercelDeploymentUrl) {
            return {
              content: [{ type: "text" as const, text: "❌ Belum ada deployment untuk workspace ini. Deploy dulu dengan deploy_to_sacms sebelum verifikasi URL." }],
              structuredContent: { ok: false, code: "NOT_FOUND", checks: [], url: "", status: 0, htmlLength: 0, looksLikeErrorPage: false, message: "No deployment yet." },
              isError: true,
            }
          }

          // Resolve which deployment this check is bound to — explicit
          // param wins, else fall back to the runId's own recorded one.
          let targetDeploymentId = deploymentId
          if (!targetDeploymentId && runId) {
            const run = await getBuildRun(auth.tenantId, runId)
            targetDeploymentId = run?.deploymentId || undefined
          }

          // If bound to a specific deployment, confirm production is
          // ACTUALLY serving it — a provider-reported READY build can sit
          // unpromoted while the domain keeps serving the previous one.
          let productionVersionMismatch = false
          const latest = tenant.vercelProjectId ? await getLatestDeployment(tenant.vercelProjectId) : null
          const servedId = latest?.state === "READY" ? latest.id : null
          productionVersionMismatch = Boolean(targetDeploymentId && servedId !== targetDeploymentId)
          const released = servedId ? await db.setting.findUnique({ where: { key: auth.tenantId + "_productionSource_" + servedId }, select: { value: true } }) : null
          const source = servedId && !released ? await getDeploymentSourceByDeploymentId(auth.tenantId, servedId) : null
          const effectiveChecks = checks && checks.length > 0 ? checks : paths ? paths.map(path => ({ path })) : [{ path, expectedText }]
          const results = (await runHttpChecks(tenant.vercelDeploymentUrl, effectiveChecks))
            .map(check => ({ ...check, deploymentId: servedId, sourceVersion: released?.value ?? source?.id ?? null }))

          const allChecksOk = results.every((r) => r.ok)
          const allOk = allChecksOk && !productionVersionMismatch

          if (runId) {
            if (productionVersionMismatch) {
              // Not a failure — likely just Vercel still propagating the
              // alias. Leave the run "verifying" (not done, not failed) so
              // a short retry is the expected next step, not a restart.
              advanceBuildRun(auth.tenantId, runId, { stage: "verifying", lastError: `Production domain is not yet serving deployment ${targetDeploymentId}.` })
            } else {
              const firstFailure = results.find((r) => !r.ok)
              advanceBuildRun(auth.tenantId, runId, allChecksOk
                // Clear any lastError left over from an earlier failed
                // attempt — re-verifying successfully must not leave a
                // stale error sitting on an otherwise-done run (chatgpt3.md).
                ? { stage: "done", lastError: null }
                : { stage: "failed", lastError: `Verification failed for ${firstFailure?.url} (status ${firstFailure?.status})` })
            }
          }

          const structured = {
            ok: allOk,
            code: productionVersionMismatch ? "PRODUCTION_VERSION_MISMATCH" : undefined,
            verifiedDeploymentId: targetDeploymentId,
            checks: results,
            url: results[0].url,
            status: results[0].status,
            htmlLength: results[0].htmlLength,
            ...(results[0].containsExpectedText !== undefined ? { containsExpectedText: results[0].containsExpectedText } : {}),
            looksLikeErrorPage: results[0].looksLikeErrorPage,
          }

          return {
            content: [{
              type: "text" as const,
              text: productionVersionMismatch
                ? `⏳ PRODUCTION_VERSION_MISMATCH — domain produksi belum menyajikan deployment ${targetDeploymentId}. Coba get_deployment_status sebentar lagi lalu verifikasi ulang, jangan dianggap gagal permanen.\n${JSON.stringify(structured, null, 2)}`
                : JSON.stringify(structured, null, 2),
            }],
            structuredContent: structured,
          }
        } catch (err: any) {
          if (runId) {
            advanceBuildRun(auth.tenantId, runId, { stage: "failed", lastError: err.message })
          }
          return {
            content: [{ type: "text" as const, text: `❌ Gagal memverifikasi URL: ${err.message}` }],
            structuredContent: { ok: false, code: "VERIFICATION_FAILED", checks: [], url: "", status: 0, htmlLength: 0, looksLikeErrorPage: false, message: err.message },
            isError: true,
          }
        }
      }
    )

    // ── configure_deployment_domain ──────────────────────────────────────────
    server.registerTool(
      "configure_deployment_domain",
      {
        title: "Configure Custom Domain on a Deployment Project",
        description: "Attach and verify a custom apex domain or subdomain to a SaCMS Cloud Hosting deployment project, with DNS diagnostics.",
        inputSchema: {
          projectId: z.string().optional().describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
          domain: z.string().describe("Custom domain name (e.g. 'mysite.com' or 'blog.mysite.com')"),
        },
      },
      async ({ projectId, domain }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Konfigurasi custom domain memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response

          const result = await addDomainToProject(resolved.projectId, domain)
          const config = await getDomainConfig(domain)

          if (auth.tenantId) {
            try {
              await db.setting.upsert({
                where: { key: `${auth.tenantId}_customDomain` },
                update: { value: domain },
                create: { tenantId: auth.tenantId, key: `${auth.tenantId}_customDomain`, value: domain }
              })
            } catch (err) {
              console.warn("[MCP configure_deployment_domain] Failed to save customDomain setting:", err)
            }
          }
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                domain: result.name,
                verified: result.verified,
                verificationRequired: result.verificationRequired,
                dnsConfig: {
                  cnameTarget: config.cname,
                  aRecordTarget: config.aRecord,
                  configured: config.configured,
                  // When set, the check against the hosting provider itself
                  // failed — `configured: false` above does NOT mean the
                  // domain's DNS is actually wrong, just that we couldn't
                  // verify it.
                  checkError: config.error,
                },
                message: config.error
                  ? "⚠️ Domain ditambahkan, tapi pengecekan status DNS gagal — coba cek lagi nanti, ini bukan berarti DNS Anda salah."
                  : result.verified ? "✅ Domain terverifikasi dan aktif!" : "⚠️ Domain ditambahkan, silakan konfigurasi DNS record di registrar domain Anda."
              }, null, 2)
            }]
          }
        } catch (err: any) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Gagal mengonfigurasi domain: ${err.message}`
            }],
            isError: true,
          }
        }
      }
    )

    // ── add_deployment_env ───────────────────────────────────────────────────
    server.registerTool(
      "add_deployment_env",
      {
        title: "Add / Update Deployment Environment Variable",
        description:
          "Create or update an environment variable on this workspace's SaCMS Cloud Hosting deployment project (upsert). " +
          "Values are stored encrypted unless the key is prefixed NEXT_PUBLIC_. The variable also " +
          "shows up in the dashboard's Environment tab and is re-applied on the next SaCMS deploy. " +
          "Note: an existing deployment must be redeployed for the change to take effect.",
        inputSchema: {
          key: z
            .string()
            .regex(/^[A-Z_][A-Z0-9_]*$/, "Use UPPER_SNAKE_CASE (letters, digits, underscore; not starting with a digit)")
            .describe("Variable name, e.g. STRIPE_SECRET_KEY or NEXT_PUBLIC_ANALYTICS_ID"),
          value: z.string().describe("Variable value"),
          projectId: z
            .string()
            .optional()
            .describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
          targets: z
            .array(z.enum(["production", "preview", "development"]))
            .optional()
            .describe("Which environments to apply to. Default: all three."),
        },
      },
      async ({ key, value, projectId, targets }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        // Same PAID gate as deploy_to_sacms/configure_deployment_domain/
        // make_deployment_public — this tool was missing it, which let a
        // workspace whose subscription had lapsed since its last real
        // deploy still rewrite production env vars (including secrets) on
        // the project that deploy created.
        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Mengatur environment variable deployment memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        const { RESERVED_ENV_KEYS } = await import("@/lib/infrastructure/frontend-env")
        if (RESERVED_ENV_KEYS.includes(key)) {
          return {
            content: [{ type: "text" as const, text: `❌ "${key}" adalah variabel sistem SaCMS dan tidak bisa ditimpa.` }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response
          const resolvedProjectId = resolved.projectId

          const result = await upsertVercelProjectEnv(
            resolvedProjectId,
            key,
            value,
            targets as VercelEnvTarget[] | undefined,
          )

          // Mirror into the tenant's stored custom env set so the dashboard
          // Environment tab stays in sync and the next SaCMS deploy re-applies it.
          if (auth.tenantId) {
            try {
              const { upsertTenantCustomEnvVar } = await import("@/lib/infrastructure/frontend-env")
              await upsertTenantCustomEnvVar(auth.tenantId, key, value)
            } catch (err) {
              console.warn("[MCP add_deployment_env] Failed to mirror env var into settings:", err)
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                key: result.key,
                type: result.type,
                targets: result.targets,
                action: result.simulated ? "simulated" : result.created ? "created" : "updated",
                projectId: resolvedProjectId,
                message: result.simulated
                  ? "⚠️ Kredensial deploy belum diset di platform — perubahan disimulasikan (tersimpan di dashboard, belum diterapkan ke hosting)."
                  : `✅ Variabel "${key}" ${result.created ? "dibuat" : "diperbarui"}. Redeploy project agar berlaku.`,
              }, null, 2),
            }],
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal set env: ${err.message}` }],
            isError: true,
          }
        }
      },
    )

    // ── list_deployment_env ──────────────────────────────────────────────────
    server.registerTool(
      "list_deployment_env",
      {
        title: "List Deployment Environment Variables",
        description:
          "List the environment variable KEY NAMES already configured for this workspace's deployment — " +
          "both system vars (auto-injected on every deploy, e.g. the SaCMS API connection vars) and custom " +
          "vars set via add_deployment_env or the dashboard's Environment tab. Returns NAMES ONLY, never " +
          "values — secrets are injected directly into the deployed app's own process.env at runtime and " +
          "never pass through this tool or this conversation. Call this BEFORE writing code that needs a " +
          "third-party API key (e.g. PRINTFUL_API_KEY) to check whether it's already configured, instead of " +
          "guessing a name or asking the user to paste the secret into chat — if it's already set, just " +
          "reference process.env.<KEY> in the generated code.",
        inputSchema: {},
        outputSchema: {
          systemVars: z.array(z.object({ key: z.string(), note: z.string() })),
          customVars: z.array(z.object({ key: z.string() })),
        },
      },
      async () => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "read")) return permissionDenied("read")

        const { SYSTEM_ENV_VARS, getTenantCustomEnvVarList } = await import("@/lib/infrastructure/frontend-env")
        const customVars = auth.tenantId ? await getTenantCustomEnvVarList(auth.tenantId) : []

        const structured = {
          systemVars: SYSTEM_ENV_VARS.map((v) => ({ key: v.key, note: v.note })),
          customVars: customVars.map((v) => ({ key: v.key })),
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(structured, null, 2) }],
          structuredContent: structured,
        }
      },
    )

    // ── call_external_api ────────────────────────────────────────────────────
    server.registerTool(
      "call_external_api",
      {
        title: "Call a Third-Party API Using a Stored Env Var",
        description:
          "Call ANY third-party API (Printful, a payment gateway, a maps provider, etc.) using a secret " +
          "already stored on this workspace's Environment tab — WITHOUT ever exposing that secret's value " +
          "to you or this conversation. Write {{ENV_KEY}} anywhere a secret belongs (a header value, a query " +
          "param, or the body) — e.g. headers: { \"Authorization\": \"Bearer {{PRINTFUL_API_KEY}}\" } — and " +
          "SaCMS substitutes the real value server-side right before the request goes out, then returns the " +
          "response to you. Use this instead of asking the user for a raw API key, and instead of generating " +
          "code that tries to call the third-party API directly from your own sandbox (it has no access to " +
          "this workspace's secrets — only SaCMS's own deployed runtime and this tool do). Call " +
          "list_deployment_env first if you're not sure which {{KEY}} names are available. The response body " +
          "is truncated at 20,000 characters and any stored secret value that appears in it is redacted.",
        inputSchema: {
          url: z.string().url().describe("Full URL of the third-party API endpoint. Supports {{ENV_KEY}} substitution."),
          method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
          headers: z.record(z.string(), z.string()).optional().describe("Header name -> value. Supports {{ENV_KEY}} substitution in values."),
          query: z.record(z.string(), z.string()).optional().describe("Query string params to append to the URL. Supports {{ENV_KEY}} substitution in values."),
          body: z.string().optional().describe("Raw request body (e.g. a JSON string). Supports {{ENV_KEY}} substitution."),
        },
      },
      async ({ url, method, headers, query, body }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        const { getTenantCustomEnvVars } = await import("@/lib/infrastructure/frontend-env")
        const envMap = auth.tenantId ? await getTenantCustomEnvVars(auth.tenantId) : {}

        const missing = new Set<string>()
        const secretsUsed = new Set<string>()
        const substitute = (input: string): string =>
          input.replace(/\{\{([A-Z_][A-Z0-9_]*)\}\}/g, (_match, key: string) => {
            if (!(key in envMap)) {
              missing.add(key)
              return ""
            }
            secretsUsed.add(envMap[key])
            return envMap[key]
          })

        let targetUrl: URL
        try {
          targetUrl = new URL(substitute(url))
        } catch {
          return { content: [{ type: "text" as const, text: "❌ URL tidak valid." }], isError: true }
        }
        if (query) {
          for (const [k, v] of Object.entries(query)) targetUrl.searchParams.set(k, substitute(v))
        }
        const resolvedHeaders: Record<string, string> = {}
        if (headers) {
          for (const [k, v] of Object.entries(headers)) resolvedHeaders[k] = substitute(v)
        }
        const resolvedBody = body !== undefined ? substitute(body) : undefined

        if (missing.size > 0) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Env var tidak ditemukan: ${[...missing].join(", ")}. Panggil list_deployment_env untuk cek nama yang tersedia, atau simpan dulu lewat add_deployment_env / tab Environment di dashboard.`,
            }],
            isError: true,
          }
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        try {
          const res = await safeFetch(targetUrl.toString(), {
            method,
            headers: resolvedHeaders,
            body: method === "GET" ? undefined : resolvedBody,
            signal: controller.signal,
          })

          let text = await res.text()
          // Defense in depth: strip any resolved secret value that made it
          // into the response (e.g. an API that echoes back its own auth
          // header in an error message) before this ever reaches the agent.
          for (const secret of secretsUsed) {
            if (secret) text = text.split(secret).join("[REDACTED]")
          }
          const TRUNCATE_AT = 20000
          const truncated = text.length > TRUNCATE_AT
          if (truncated) text = `${text.slice(0, TRUNCATE_AT)}\n…(dipotong, total ${text.length} karakter)`

          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                status: res.status,
                statusText: res.statusText,
                contentType: res.headers.get("content-type") || null,
                body: text,
                truncated,
              }, null, 2),
            }],
          }
        } catch (err: any) {
          const message = err?.name === "AbortError" ? "Request timeout setelah 15 detik" : (err?.message || "Request gagal")
          return { content: [{ type: "text" as const, text: `❌ Gagal memanggil API eksternal: ${message}` }], isError: true }
        } finally {
          clearTimeout(timeoutId)
        }
      },
    )

    // ── make_deployment_public ───────────────────────────────────────────────
    server.registerTool(
      "make_deployment_public",
      {
        title: "Make Deployment Publicly Viewable",
        description:
          "Turn off deployment protection on this workspace's SaCMS Cloud Hosting project, so " +
          "its deployment links (including the per-deployment URL with a random suffix, e.g. " +
          "my-site-abc123-team.example.com — not just the clean production alias) can be opened by anyone with the " +
          "link, without needing to log in. This is a project-wide security setting change — only call it " +
          "when the user explicitly wants the deployment publicly viewable.",
        inputSchema: {
          projectId: z.string().optional().describe("Deployment Project ID. Defaults to this workspace's linked deployment project."),
        },
      },
      async ({ projectId }) => {
        const auth = authContext.getStore()
        if (!auth) return UNAUTHORIZED
        if (!hasScope(auth, "write")) return permissionDenied("write")

        if (!auth.isHostingPlanPaid) {
          return {
            content: [{
              type: "text" as const,
              text: `❌ Payment Required: Mengatur visibilitas deployment memerlukan workspace berstatus PAID. Silakan selesaikan pembayaran di dashboard: /dashboard/${auth.tenantSlug}/subscriptions`
            }],
            isError: true,
          }
        }

        try {
          const resolved = await resolveOwnProjectId(auth, projectId)
          if (!resolved.ok) return resolved.response
          const resolvedProjectId = resolved.projectId

          const result = await disableVercelDeploymentProtection(resolvedProjectId)
          if (!result.ok) {
            return {
              content: [{ type: "text" as const, text: `❌ Gagal menonaktifkan proteksi: ${result.error}` }],
              isError: true,
            }
          }

          return {
            content: [{
              type: "text" as const,
              text: "✅ Proteksi deployment dinonaktifkan. Semua URL deployment project ini (termasuk URL per-deployment dengan akhiran acak) sekarang bisa dibuka siapa saja tanpa login.",
            }],
          }
        } catch (err: any) {
          return {
            content: [{ type: "text" as const, text: `❌ Gagal menonaktifkan proteksi: ${err.message}` }],
            isError: true,
          }
        }
      },
    )

    // Member (end-user) management intentionally has no MCP tools. Members
    // are the tenant's own app's end-users, managed through the dashboard's
    // Users & Permissions section (Strapi-parity model) — an AI agent
    // building schemas/content via MCP has no legitimate reason to create,
    // promote, or delete end-user accounts, and the tools that used to live
    // here skipped the dashboard's role-existence/status-enum validation
    // entirely. Removed rather than patched.
}
