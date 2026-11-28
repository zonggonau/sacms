import { createHash, randomBytes } from "node:crypto"
import { Sandbox } from "@vercel/sandbox"
import type { createMcpHandler } from "mcp-handler"
type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]
import { z } from "zod"
import { db } from "@/lib/database"
import { findSchemaDemoWorkspace } from "./demo-tenant"
import { previewCredential, previewRelay, verifyPublicPreview } from "./preview-access"
import { resolveApiOrigin } from "./frontend-env"
import { starterChangeBreach, starterLockBreach, templateLockKey, workspaceLockKey } from "./starter-template"
import { createTargetProject, getVercelTeamId, getVercelToken } from "@/lib/vercel-client"
import { websiteTemplateFilesSchema, websiteTemplateFileSchema, type WebsiteTemplateFile } from "@/lib/validations/website-template"
import type { McpPreviewSession } from "../../../prisma/generated-client"

const lifetime = 30 * 60_000
const INSTALL_LOG = "/tmp/sacms-install.log"
const DEV_LOG = "/tmp/sacms-dev.log"
const LOG_TAIL_BYTES = 8_000
const parseFiles = (value: unknown) => websiteTemplateFilesSchema.parse(value)
export const active = (s: McpPreviewSession) => s.expiresAt.getTime() > Date.now() && ["ready", "starting", "editing"].includes(s.status)
// An expired session that still holds unsaved edits stays visible as "expired", so it gets saved or resumed.
export const reportable = (s: McpPreviewSession) => active(s) || (s.dirty && s.status === "ready")

export function describeSession(scope: string, target: string, session: McpPreviewSession | null) {
  const status = !session ? "inactive" : session.expiresAt.getTime() <= Date.now() ? "expired" : session.status === "editing" ? "starting" : session.status
  return { scope, target, status, previewKind: "code", contentMode: "published", previewUrl: status === "ready" ? `https://${session!.id}.preview.sacms.cloud` : null,
    accessUrl: status === "ready" ? `https://${session!.id}.preview.sacms.cloud/?preview_access=${previewCredential(session!.id, "browser")}` : null,
    revision: session?.revision ?? 0, hasUnsavedChanges: session?.dirty ?? false, expiresAt: session?.expiresAt.toISOString() ?? null,
    sourceVersion: session?.sourceVersion ?? null }
}

async function sessionSandbox(session: McpPreviewSession) {
  if (!session.vercelProjectId || !session.vercelTeamId || !session.sandbox) {
    throw Error("Sesi lama belum menyimpan proyek Sandbox. Simpan perubahan, hentikan sesi, lalu buka preview baru.")
  }
  return Sandbox.get({ name: session.sandbox, projectId: session.vercelProjectId, teamId: session.vercelTeamId, token: await getVercelToken() })
}

async function tailLog(box: Sandbox, path: string, bytes = LOG_TAIL_BYTES) {
  const buffer = await box.readFileToBuffer({ path }).catch(() => null)
  if (!buffer) return { log: "", truncated: false }
  return { log: buffer.subarray(Math.max(0, buffer.length - bytes)).toString("utf8"), truncated: buffer.length > bytes }
}

function checkPaths(files: WebsiteTemplateFile[]) {
  for (const { path } of files) {
    if (path.includes("\\") || path.split("/").some(p => !p || [".", "..", "node_modules", ".git", ".next"].includes(p))) throw Error("Invalid preview file path")
  }
}
function buffers(files: WebsiteTemplateFile[]) {
  checkPaths(files)
  return files.map(f => ({ path: f.path, content: Buffer.from(f.content, f.encoding ?? "utf-8") }))
}

type Actor = { tokenId: string; tokenName: string }
export function registerGlobalPreviews(server: McpServer, actor: () => Actor | undefined) {
  registerPreviews(server, actor)
}

type Workspace = { tenantId: string; tenantSlug: string; canRead: boolean; canWrite: boolean }
export function registerWorkspacePreviews(server: McpServer, workspace: () => Workspace | undefined) {
  registerPreviews(server, undefined, workspace)
}

function registerPreviews(server: McpServer, actor?: () => Actor | undefined, workspace?: () => Workspace | undefined) {
  const scope = workspace ? "workspace" : "global"
  const selector = { siteId: z.string().optional(), templateId: z.string().optional() }
  const describe = (target: string, s: McpPreviewSession | null) => describeSession(scope, target, s)
  const template = async (input: { templateId?: string; siteId?: string }, write = false) => {
    if (workspace) {
      if (input.templateId) throw Error("Use siteId for a workspace preview")
      const auth = workspace()
      if (!auth || !(write ? auth.canWrite : auth.canRead)) throw Error("Insufficient workspace permission")
      const site = await db.tenant.findUniqueOrThrow({ where: { id: auth.tenantId }, select: { vercelProjectId: true, vercelDeploymentUrl: true } })
      if (input.siteId && site.vercelProjectId !== input.siteId) throw Error("Site not found in workspace")
      const { getLatestDeploymentSource } = await import("./mcp-deployment-source")
      const snapshot = await getLatestDeploymentSource(auth.tenantId)
      const files = snapshot ? snapshot.files.map(f => ({ path: f.name, content: f.content, encoding: f.encoding })) : [
        { path: "package.json", content: JSON.stringify({ private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "16", react: "19", "react-dom": "19" } }) },
        { path: "app/layout.jsx", content: "export default function Layout({ children }) { return <html><body>{children}</body></html> }" },
        { path: "app/page.jsx", content: "export default function Home() { return <main /> }" },
      ]
      if (!snapshot && site.vercelDeploymentUrl) throw Error("Import existing site source with get_deployment_source before editing")
      return { id: auth.tenantId, slug: auth.tenantSlug, files, version: snapshot?.id ?? "initial",
        sourceVersion: new Date(0), schemaTemplateId: "", schemaTemplate: null, projectId: site.vercelProjectId }
    }
    if (input.siteId || !actor?.() || !input.templateId) throw Error("Template and authorization required")
    const t = await db.websiteTemplate.findFirstOrThrow({ where: { deletedAt: null, OR: [{ id: input.templateId }, { slug: input.templateId }] },
      include: { schemaTemplate: { select: { id: true, demoTenantId: true } } } })
    return { ...t, version: t.sourceVersion.toISOString(), projectId: t.demoVercelProjectId }
  }
  const lookup = (targetId: string) => db.mcpPreviewSession.findUnique({ where: { scope_targetId: { scope, targetId } } })
  // Edits to a starter file are refused (see starter-template.ts): the starter stays the base, only additions land.
  const guardStarter = async (targetId: string, files: { path: string; content: string }[]) => {
    const breach = await starterLockBreach(workspace ? workspaceLockKey(targetId) : templateLockKey(targetId), files)
    if (breach) throw Error(breach)
  }
  async function current(input: { templateId?: string; siteId?: string }, write = false) {
    const t = await template(input, write)
    const s = await lookup(t.id)
    if (!s || !active(s) || s.status !== "ready" || !s.sandbox) throw Error("Preview is not ready")
    return { t, s }
  }
  const result = (data: Record<string, unknown>) => ({ structuredContent: data, content: [{ type: "text" as const, text: JSON.stringify(data) }] })

  async function getPreview(input: { templateId?: string; siteId?: string }) {
    const t = await template(input)
    const s = await lookup(t.id)
    return result(describe(t.slug, s && reportable(s) ? s : null))
  }
  async function startPreview(input: { templateId?: string; siteId?: string }) {
    const t = await template(input, true)
    const existing = await lookup(t.id)
    if (existing && active(existing)) return result(describe(t.slug, existing))
    const demo = t.schemaTemplate ? await findSchemaDemoWorkspace(db, t.schemaTemplate) : { id: t.id, slug: t.slug }
    if (!demo) throw Error("Template has no verified demo workspace")
    const resumable = existing && !active(existing) && existing.dirty && existing.status === "ready" ? existing : null
    const files = parseFiles(resumable ? resumable.files : t.files)
    const initial = buffers(files)
    const id = randomBytes(8).toString("hex")
    const s = await db.$transaction(async tx => {
      if (existing) await tx.mcpPreviewSession.deleteMany({ where: { id: existing.id } })
      return tx.mcpPreviewSession.create({ data: { id, scope, targetId: t.id, target: t.slug, status: "starting",
        files, sourceVersion: resumable?.sourceVersion ?? t.version, revision: resumable?.revision ?? 0, dirty: !!resumable,
        expiresAt: new Date(Date.now() + lifetime) } })
    }).catch(async error => {
      const winner = await lookup(t.id)
      if (winner && active(winner)) return winner
      throw error
    })
    if (s.id !== id) return result(describe(t.slug, s))
    let box: Sandbox | undefined
    try {
      const [token, teamId] = await Promise.all([getVercelToken(), getVercelTeamId()])
      if (!token || !teamId) throw Error("Token Vercel dan Team ID harus dikonfigurasi untuk membuat Sandbox.")
      let projectId = t.projectId
      if (!projectId) {
        const name = ((workspace ? "sacms-" : "sacms-demo-") + t.slug).toLowerCase().replace(/[^a-z0-9-]/g, "-")
        const created = await createTargetProject(name, teamId, token)
        // Another request (e.g. the first hosting build) can bind the target
        // while Vercel provisions its project. Keep the authoritative binding.
        if (workspace) {
          await db.tenant.updateMany({ where: { id: t.id, vercelProjectId: null }, data: { vercelProjectId: created } })
          projectId = (await db.tenant.findUniqueOrThrow({ where: { id: t.id }, select: { vercelProjectId: true } })).vercelProjectId
        } else {
          await db.websiteTemplate.updateMany({ where: { id: t.id, deletedAt: null, demoVercelProjectId: null }, data: { demoVercelProjectId: created } })
          projectId = (await db.websiteTemplate.findFirstOrThrow({ where: { id: t.id, deletedAt: null }, select: { demoVercelProjectId: true } })).demoVercelProjectId
        }
        if (!projectId) throw Error("Gagal menyimpan proyek Vercel untuk target preview.")
      }
      const config = { token, teamId, projectId }
      box = await Sandbox.create({ ...config, runtime: "node24", ports: [3001], timeout: lifetime, persistent: false }).catch((error: unknown) => {
        if ((error as { response?: { status?: number } } | null)?.response?.status === 404) {
          throw new Error(`Vercel mengembalikan 404 saat membuat Sandbox untuk project ${config.projectId} di team ${config.teamId}. Periksa proyek yang terhubung dengan target ini dan akses token team.`)
        }
        throw error
      })
      await db.mcpPreviewSession.update({ where: { id }, data: { vercelProjectId: projectId, vercelTeamId: teamId, sandbox: box.name, upstream: box.domain(3001) } })
      await box.runCommand({ cmd: "node", args: ["-e", previewRelay], detached: true, env: { PREVIEW_UPSTREAM_KEY: previewCredential(id, "upstream") } })
      await box.writeFiles(initial)
      const install = await box.runCommand({ cmd: "sh", args: ["-c", `npm install --no-audit --no-fund > ${INSTALL_LOG} 2>&1`] })
      if (install.exitCode !== 0) throw Error("Preview dependency install failed:\n" + (await tailLog(box, INSTALL_LOG, 4_000)).log)
      const demoKey = "sacms_live_" + randomBytes(24).toString("hex")
      await db.apiToken.create({ data: { name: "Template preview " + id, tenantId: demo.id,
        type: "preview", permissions: ["read"], token: createHash("sha256").update(demoKey).digest("hex"), expiresAt: s.expiresAt } })
      await box.runCommand({ cmd: "sh", args: ["-c", `npm run dev -- --hostname 127.0.0.1 --port 3000 > ${DEV_LOG} 2>&1`], detached: true,
        env: { NEXT_PUBLIC_SACMS_TENANT: demo.slug, NEXT_PUBLIC_SACMS_API_URL: resolveApiOrigin(), SACMS_API_KEY: demoKey } })
      const probe = await box.runCommand("node", ["-e", "async function ready(){for(let i=0;i<60;i++){try{if((await fetch('http://localhost:3000')).ok)return}catch{}await new Promise(r=>setTimeout(r,1000))}process.exit(1)}ready()"])
      if (probe.exitCode !== 0) throw Error("Preview server did not become ready:\n" + (await tailLog(box, DEV_LOG, 4_000)).log)
      await verifyPublicPreview(id)
      return result(describe(t.slug, await db.mcpPreviewSession.update({ where: { id }, data: { status: "ready" } })))
    } catch (error) {
      await box?.stop().catch(() => {})
      await db.mcpPreviewSession.updateMany({ where: { id }, data: { status: "failed" } })
      throw error
    }
  }

  const startDescription = "Start or reuse a code preview with published CMS content."
  const getDescription = "Read session status, sourceVersion and accessUrl without starting a Sandbox."
  server.registerTool("start_preview", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, description: startDescription, inputSchema: selector }, startPreview)
  server.registerTool("get_preview_url", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, description: getDescription, inputSchema: selector }, getPreview)
  if (!workspace) {
    const target = { websiteTemplateId: z.string().min(1) }
    server.registerTool("start_website_template_preview", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, description: startDescription, inputSchema: target },
      ({ websiteTemplateId }) => startPreview({ templateId: websiteTemplateId }))
    server.registerTool("get_website_template_preview", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, description: getDescription, inputSchema: target },
      ({ websiteTemplateId }) => getPreview({ templateId: websiteTemplateId }))
  }
  server.registerTool("read_preview_file", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, description: "Read a file from the current preview revision.", inputSchema: { ...selector, path: z.string() } }, async ({ path, ...input }) => {
    const { s } = await current(input)
    const file = parseFiles(s.files).find(f => f.path === path)
    if (!file) throw Error("File not found")
    const box = await sessionSandbox(s)
    const bytes = await box.readFileToBuffer({ path: file.path })
    if (!bytes) throw Error("File no longer exists in Sandbox")
    const content = bytes.toString(file.encoding ?? "utf-8")
    return result({ revision: s.revision, ...file, content })
  })
  server.registerTool("apply_preview_changes", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, description: "Write changed files to the same live preview.", inputSchema: { ...selector,
    expectedRevision: z.number().int(), changedFiles: z.array(websiteTemplateFileSchema).min(1).max(200) } }, async ({ expectedRevision, changedFiles, ...input }) => {
    const { t, s } = await current(input, true)
    const merged = new Map(parseFiles(s.files).map(f => [f.path, f]))
    for (const file of changedFiles) merged.set(file.path, file)
    const files = parseFiles([...merged.values()])
    // Only the files this call writes are judged; the rest of the session is what save_preview_changes checks.
    const breach = await starterChangeBreach(workspace ? workspaceLockKey(t.id) : templateLockKey(t.id), changedFiles)
    if (breach) throw Error(breach)
    const batch = buffers(changedFiles)
    const box = await sessionSandbox(s)
    const lock = await db.mcpPreviewSession.updateMany({ where: { id: s.id, revision: expectedRevision, status: "ready" }, data: { status: "editing" } })
    if (!lock.count) throw Error("CONFLICT: preview revision changed")
    try {
      await box.writeFiles(batch)
      return result(describe(s.target, await db.mcpPreviewSession.update({ where: { id: s.id }, data: { files, revision: { increment: 1 }, dirty: true, status: "ready" } })))
    } catch (error) {
      await db.mcpPreviewSession.updateMany({ where: { id: s.id }, data: { status: "failed" } })
      await box.stop().catch(() => {})
      throw error
    }
  })
  server.registerTool("save_preview_changes", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, description: "Save the current revision to its source history. Workspace production releases are made from Infrastructure → Hosting.", inputSchema: { ...selector, expectedSourceVersion: z.string() } }, async ({ expectedSourceVersion, ...input }) => {
    const t = await template(input, true)
    const s = await lookup(t.id)
    // An expired session keeps its edited files in the DB, so they can still be saved.
    if (!s || s.status !== "ready" || (!active(s) && !s.dirty)) throw Error("Preview is not ready")
    if (expectedSourceVersion !== s.sourceVersion || expectedSourceVersion !== t.version) throw Error("CONFLICT: source version changed")
    if (!s.dirty) return result(describe(t.slug, s))
    if (workspace) {
      await guardStarter(t.id, parseFiles(s.files))
      const files = parseFiles(s.files).map(f => ({ name: f.path, content: f.content, encoding: f.encoding ?? "utf-8" as const }))
      const { activeSchema } = await import("./site-schema-contract")
      const schemaSnapshot = await activeSchema(t.id, t.slug)
      const { buildManifest } = await import("./mcp-deployment-source")
      const updated = await db.$transaction(async tx => {
        const latest = await tx.mcpDeploymentSource.findFirst({ where: { tenantId: t.id }, orderBy: { createdAt: "desc" }, select: { id: true } })
        if ((latest?.id ?? "initial") !== expectedSourceVersion) throw Error("CONFLICT: workspace source changed")
        const revision = await tx.mcpDeploymentSource.create({ data: { tenantId: t.id, schemaSnapshot, deploymentId: "draft:" + s.id + ":" + s.revision, projectId: t.projectId, files, manifest: buildManifest(files) as unknown as object } })
        return tx.mcpPreviewSession.update({ where: { id: s.id, revision: s.revision, status: "ready", dirty: true }, data: { sourceVersion: revision.id, dirty: false } })
      }, { isolationLevel: "Serializable" })
      return result(describe(t.slug, updated))
    }
    const next = new Date(Math.max(Date.now(), t.sourceVersion.getTime() + 1))
    const files = parseFiles(s.files)
    await guardStarter(t.id, files)
    const saved = await db.$transaction(async tx => {
      const updated = await tx.mcpPreviewSession.update({ where: { id: s.id, revision: s.revision, status: "ready", dirty: true }, data: { sourceVersion: next.toISOString(), dirty: false } })
      await tx.websiteTemplate.update({ where: { id: t.id, sourceVersion: t.sourceVersion, deletedAt: null }, data: { files, sourceVersion: next } })
      const schema = await tx.schemaTemplate.findUniqueOrThrow({ where: { id: t.schemaTemplateId }, select: { schema: true } })
      const latest = await tx.websiteTemplateVersion.aggregate({ where: { websiteTemplateId: t.id }, _max: { version: true } })
      const base = { websiteTemplateId: t.id, schema: schema.schema as object, changedBy: actor!()!.tokenName, tokenId: actor!()!.tokenId }
      if (!latest._max.version) await tx.websiteTemplateVersion.create({ data: { ...base, version: 1, files: parseFiles(t.files), summary: "Before preview edits" } })
      const version = (latest._max.version ?? 1) + 1
      await tx.websiteTemplateVersion.create({ data: { ...base, version, files, summary: "Saved preview changes" } })
      return { ...describe(t.slug, updated), version }
    })
    return result(saved)
  })
  server.registerTool("get_preview_logs", { annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, description: "Read the end of the preview's dev-server output (compile and runtime errors) and of its dependency install. Check this whenever a page renders an error or blank after apply_preview_changes.", inputSchema: selector }, async input => {
    const { s } = await current(input)
    const box = await sessionSandbox(s)
    const [dev, install] = await Promise.all([tailLog(box, DEV_LOG), tailLog(box, INSTALL_LOG, 2_000)])
    return result({ revision: s.revision, devServer: dev.log, devServerTruncated: dev.truncated, install: install.log })
  })
  server.registerTool("extend_preview", { annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }, description: "Keep an active preview running for another 30 minutes from now. Call it before expiresAt during a long edit session; an expired session with unsaved edits can still be saved, and start_preview resumes it.", inputSchema: selector }, async input => {
    const { s } = await current(input, true)
    const expiresAt = new Date(Date.now() + lifetime)
    const extendBy = expiresAt.getTime() - s.expiresAt.getTime()
    if (extendBy <= 0) return result(describe(s.target, s))
    const box = await sessionSandbox(s)
    await box.extendTimeout(extendBy)
    await db.apiToken.updateMany({ where: { name: "Template preview " + s.id }, data: { expiresAt } })
    return result(describe(s.target, await db.mcpPreviewSession.update({ where: { id: s.id }, data: { expiresAt } })))
  })
  server.registerTool("stop_preview", { annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true }, description: "Stop a preview. Unsaved edits require discardChanges.", inputSchema: { ...selector, discardChanges: z.boolean().optional() } }, async ({ discardChanges, ...input }) => {
    const t = await template(input, true)
    const s = await lookup(t.id)
    if (!s || !active(s) || s.dirty && !discardChanges) return result(describe(t.slug, s))
    if (s.status !== "ready") throw Error("Preview is busy")
    const box = s.vercelProjectId && s.vercelTeamId ? await sessionSandbox(s) : null
    const locked = await db.mcpPreviewSession.updateMany({ where: { id: s.id, revision: s.revision, status: "ready" }, data: { status: "stopping" } })
    if (!locked.count) throw Error("CONFLICT: preview changed")
    try { await box?.stop() } catch (error) {
      await db.mcpPreviewSession.updateMany({ where: { id: s.id, status: "stopping" }, data: { status: "ready" } })
      throw error
    }
    return result(describe(t.slug, await db.mcpPreviewSession.update({ where: { id: s.id }, data: { status: "stopped", dirty: false, files: [] } })))
  })
}
