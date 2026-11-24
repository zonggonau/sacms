import { getLatestDeploymentSource } from "@/lib/infrastructure/mcp-deployment-source"
import { NextResponse } from "next/server"
import { getWebsiteTemplateRun, websiteTemplateRunKey } from "@/lib/infrastructure/website-template-run"
import { db, getTenantDb } from "@/lib/database"
import { hasReadyProduction, addDomainToProject, deleteVercelProject, getDomainConfig, removeDomainFromProject } from "@/lib/vercel-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"
import { isTenantPlanPaid } from "@/lib/infrastructure/hosting-plan"
import { deployTenantFrontend, redeployTenantFrontend } from "@/lib/infrastructure/deploy-frontend"
import { assertSchemaEditable } from "@/lib/schema-lock"
import { wipeTenantSchema } from "@/lib/schema-wipe"

export const GET = withStaffAuth(async (_req, _context, { access, session }) => {
    const tenant = access.tenant
    const tenantId = tenant.id

    const settings = await db.setting.findMany({
        where: {
          tenantId,
          key: {
            in: [
              `${tenantId}_hostingStatus`,
              `${tenantId}_hostingExpiresAt`,
              `${tenantId}_vercelDeploymentUrl`,
              `${tenantId}_vercelProjectId`,
              `${tenantId}_customDomain`,
            ],
          },
        },
      })

    const hostingStatusSetting = settings.find((s) => s.key === `${tenantId}_hostingStatus`)?.value
    const hostingExpiresAtSetting = settings.find((s) => s.key === `${tenantId}_hostingExpiresAt`)?.value
    const rawVercelUrl = (tenant as any).vercelDeploymentUrl || settings.find((s) => s.key === `${tenantId}_vercelDeploymentUrl`)?.value || null
    const rawVercelProjectId = (tenant as any).vercelProjectId || settings.find((s) => s.key === `${tenantId}_vercelProjectId`)?.value || null
    const customDomain = (tenant as any).customDomain || settings.find((s) => s.key === `${tenantId}_customDomain`)?.value || null

    // Confirm the Vercel project is actually still there before reporting it
    // as deployed — a project deleted directly on vercel.com otherwise keeps
    // showing as "Live" forever in the Hosting tab, since nothing else ever
    // re-checks it. A confirmed deletion self-heals the stale DB fields too.
    const { resolveTenantHostingStatus } = await import("@/lib/infrastructure/hosting-status")
    const subdomainTokenRow = await db.tenant.findUnique({ where: { id: tenantId }, select: { publicSubdomainToken: true } })
    const vercelStatus = await resolveTenantHostingStatus(tenantId, rawVercelUrl, rawVercelProjectId, db, subdomainTokenRow?.publicSubdomainToken || tenant.slug)
    const vercelUrl = vercelStatus.url
    const vercelProjectId = vercelStatus.projectId

    const hostingStatus = (tenant as any).hostingStatus || hostingStatusSetting || "trial"
    const hostingExpiresAt = (tenant as any).hostingExpiresAt || (hostingExpiresAtSetting ? new Date(hostingExpiresAtSetting) : null)

    const isPaid = isTenantPlanPaid(tenant.plan) || session.user.role === "super_admin"
    const isEnterprise = Boolean(tenant.plan?.toLowerCase().includes("enterprise") || session.user.role === "super_admin")
    const isHostingActive = isEnterprise || Boolean(hostingStatus === "active" && hostingExpiresAt && new Date(hostingExpiresAt) > new Date())

    return NextResponse.json({
      hostingStatus,
      hostingExpiresAt,
      isHostingActive,
      sourceRevision: (await db.mcpDeploymentSource.findFirst({ where: { tenantId }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id ?? null,
      hasProduction: vercelProjectId ? (await hasReadyProduction(vercelProjectId)) ?? Boolean(vercelUrl) : false,
      vercelDeploymentUrl: vercelUrl,
      vercelProjectId,
      customDomain,
      plan: tenant.plan,
      dnsTemplate: {
        apex: { type: "A", name: "@", value: "76.76.21.21", description: "A-Record untuk root domain (@)" },
        cname: { type: "CNAME", name: "www", value: "cname.vercel-dns.com", description: "CNAME Record untuk subdomain" },
        txt: { type: "TXT", name: "_vercel", value: "vc-domain-verify", description: "TXT Record untuk verifikasi domain" },
      },
    })
})

export const POST = withStaffAuth(
  async (req, _context, { access, session }) => {
    const body = await req.json().catch(() => ({}))
    const { action, domain } = body

    const tenant = access.tenant
    const tenantId = tenant.id
    const tenantSlug = tenant.slug

    // ── ACTION: LIVE HEALTH PING MONITORING ──────────────────────────────────
    if (action === "ping") {
      const targetUrl = body.url?.trim() || (tenant as any).vercelDeploymentUrl || "https://kabnabire.vercel.app"
      const formattedUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`
      const startTime = performance.now()

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const res = await fetch(formattedUrl, {
          method: "HEAD",
          headers: { "User-Agent": "SaCMS-Deploy-Monitor/1.0" },
          signal: controller.signal,
          redirect: "follow",
        })
        clearTimeout(timeoutId)

        const latencyMs = Math.round(performance.now() - startTime)
        const vercelId = res.headers.get("x-vercel-id") || null
        const server = res.headers.get("server") || "SaCMS Cloud Hosting"
        const regionCode = vercelId ? vercelId.split("::")[0] : null

        return NextResponse.json({
          success: true,
          status: res.status,
          statusText: res.statusText || (res.status === 200 ? "OK" : "Active"),
          latencyMs,
          vercelId,
          regionCode,
          server,
          ssl: formattedUrl.startsWith("https"),
          checkedAt: new Date().toISOString(),
        })
      } catch (err: any) {
        const latencyMs = Math.round(performance.now() - startTime)
        return NextResponse.json({
          success: false,
          error: err.name === "AbortError" ? "Timeout (server tidak merespons dalam 8 detik)" : (err.message || "Gagal menghubungi server"),
          latencyMs,
          status: 0,
          statusText: "Offline / Timeout",
          checkedAt: new Date().toISOString(),
        })
      }
    }

    // ── BILLING GATE: deploying to production requires a paid plan ──────────
    const isPaid = isTenantPlanPaid(tenant.plan) || session.user.role === "super_admin"
    if ((action === "deploy-production" || action === "deploy" || action === "redeploy" || action === "domain") && !isPaid) {
      return apiError("plan_limit", {
        message: "Deploy ke hosting produksi memerlukan paket berbayar. Upgrade paket Anda untuk melanjutkan.",
        details: { redirectTo: `/dashboard/${tenantSlug}/subscriptions`, plan: tenant.plan },
      })
    }

    // ── ACTION: REDEPLOY (re-run the existing project, no new files) ───────
    if (action === "deploy-production") {
      try {
        const source = await getLatestDeploymentSource(tenantId)
        if ((source?.id ?? null) !== body.sourceRevision) return NextResponse.json({ error: "Versi source berubah. Refresh Hosting sebelum merilis." }, { status: 409 })
        if (!source && !(await db.tenant.findUnique({ where: { id: tenantId }, select: { vercelDeploymentUrl: true } }))?.vercelDeploymentUrl) return NextResponse.json({ error: "Simpan source website sebelum deploy production." }, { status: 400 })
        const { resolveApiOrigin } = await import("@/lib/infrastructure/frontend-env")
        const deployResult = source
          ? await deployTenantFrontend(tenantId, tenantSlug, resolveApiOrigin(), source.files)
          : await redeployTenantFrontend(tenantId, tenantSlug)
        if (source && deployResult.deploymentId) {
          const key = tenantId + "_productionSource_" + deployResult.deploymentId
          await db.setting.upsert({ where: { key }, create: { key, tenantId, value: source.id }, update: { value: source.id } })
        }
        return NextResponse.json({
          success: true,
          ...deployResult,
          sourceVersion: source?.id ?? null,
          hostType: deployResult.simulated ? "simulation" : "vercel",
        })
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Gagal melakukan redeploy" }, { status: 400 })
      }
    }

    // ── ACTION: DELETE PROJECT (irreversible — wipes the Vercel project and
    // every deployment under it, so the workspace can redeploy clean later) ─
    if (action === "delete-project") {
      const existingProjectId = await db.setting.findUnique({ where: { key: `${tenantId}_vercelProjectId` } })
      const projectId = existingProjectId?.value || (tenant as any).vercelProjectId

      if (!projectId) {
        return NextResponse.json({ error: "Tidak ada project Vercel untuk dihapus" }, { status: 400 })
      }

      const result = await deleteVercelProject(projectId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error || "Gagal menghapus project di Vercel" }, { status: 400 })
      }

      await Promise.all([
        db.tenant.update({
          where: { id: tenantId },
          data: { vercelDeploymentUrl: null, vercelProjectId: null, customDomain: null },
        }).catch((err) => console.warn("Failed to clear tenant vercel fields after delete:", err)),
        db.setting.deleteMany({
          where: {
            key: {
              in: [`${tenantId}_vercelDeploymentUrl`, `${tenantId}_vercelProjectId`, `${tenantId}_customDomain`],
            },
          },
        }).catch(() => null),
      ])

      return NextResponse.json({ success: true })
    }

    // ── ACTION: RESET WEBSITE (delete-project + wipe schema + clear
    // sourceWebsiteTemplateId in one action) — lets a tenant cleanly "start
    // over" and apply a different Website Template, instead of the two
    // disconnected manual steps (Hapus Project + Hapus Semua Schema) this
    // replaces. Vercel deletion runs first since it's the one step that can
    // fail against an external system — on failure nothing is written to
    // the DB yet, so a retry is always safe. ──────────────────────────────
    if (action === "reset-website") {
      if (access.isGlobal) {
        return apiError("forbidden", { message: "Reset website tidak tersedia untuk workspace SaCMS Global." })
      }

      const lockError = await assertSchemaEditable(tenantId)
      if (lockError) return apiError("forbidden", { message: lockError.error })
      const applying = await getWebsiteTemplateRun(tenantId)
      if (applying && applying.expiresAt > Date.now()) {
        return apiError("conflict", { message: "Tunggu sampai penerapan Website Template selesai sebelum mereset workspace." })
      }

      const existingProjectId = await db.setting.findUnique({ where: { key: `${tenantId}_vercelProjectId` } })
      const projectId = existingProjectId?.value || (tenant as any).vercelProjectId

      if (projectId) {
        const result = await deleteVercelProject(projectId)
        if (!result.ok) {
          return NextResponse.json(
            { error: result.error || "Gagal menghapus project di Vercel — reset dibatalkan, schema tidak disentuh." },
            { status: 400 },
          )
        }
      }

      await Promise.all([
        db.tenant.update({
          where: { id: tenantId },
          data: { vercelDeploymentUrl: null, vercelProjectId: null, customDomain: null, sourceWebsiteTemplateId: null },
        }).catch((err) => console.warn("Failed to clear tenant fields during reset-website:", err)),
        db.setting.deleteMany({
          where: { key: { in: [`${tenantId}_vercelDeploymentUrl`, `${tenantId}_vercelProjectId`, `${tenantId}_customDomain`] } },
        }).catch(() => null),
      ])

      const tenantDb = await getTenantDb(tenantSlug)
      const deletedSchema = await wipeTenantSchema(tenantDb, tenantId)
      await db.setting.deleteMany({ where: { key: websiteTemplateRunKey(tenantId) } })

      return NextResponse.json({ success: true, deletedSchema })
    }

    // ── ACTION: LINK / UPDATE VERCEL DEPLOYMENT URL ─────────────────────────
    if (action === "link") {
      const deployUrl = body.url?.trim()
      const vercelProjectId = body.projectId?.trim()
      if (!deployUrl) {
        return NextResponse.json({ error: "URL deployment diperlukan" }, { status: 400 })
      }

      const formattedUrl = deployUrl.startsWith("http") ? deployUrl : `https://${deployUrl}`

      await Promise.all([
        db.tenant.update({
          where: { id: tenantId },
          data: {
            vercelDeploymentUrl: formattedUrl,
            vercelProjectId: vercelProjectId || undefined,
          }
        }).catch((err) => console.warn("Failed to update tenant vercel URL:", err)),
        db.setting.upsert({
          where: { key: `${tenantId}_vercelDeploymentUrl` },
          update: { value: formattedUrl },
          create: { tenantId, key: `${tenantId}_vercelDeploymentUrl`, value: formattedUrl }
        }),
        ...(vercelProjectId ? [
          db.setting.upsert({
            where: { key: `${tenantId}_vercelProjectId` },
            update: { value: vercelProjectId },
            create: { tenantId, key: `${tenantId}_vercelProjectId`, value: vercelProjectId }
          })
        ] : []),
      ])

      return NextResponse.json({
        success: true,
        url: formattedUrl,
        projectId: vercelProjectId,
      })
    }

    // ── ACTION 1: ADD / CONFIGURE CUSTOM DOMAIN FOR VERCEL ──────────────────
    if (action === "domain") {
      if (!domain) {
        return NextResponse.json({ error: "Domain name is required" }, { status: 400 })
      }

      const cleanDomain = domain.toLowerCase().trim()

      const existingProjectId = await db.setting.findUnique({
        where: { key: `${tenantId}_vercelProjectId` }
      })

      const projectId = body.projectId?.trim() || existingProjectId?.value || (tenant as any).vercelProjectId
      if (!projectId) {
        return NextResponse.json(
          { error: "Belum ada deployment untuk workspace ini. Deploy terlebih dahulu lewat deploy_to_sacms sebelum mengatur domain." },
          { status: 400 },
        )
      }

      // Changing to a different domain — detach the old one from the Vercel
      // project first (best-effort) so it doesn't keep sitting there forever;
      // Tenant.customDomain only ever tracks ONE "current" domain per workspace.
      const previousDomain = (tenant as any).customDomain as string | null
      if (previousDomain && previousDomain !== cleanDomain) {
        await removeDomainFromProject(projectId, previousDomain).catch((err) =>
          console.warn("[deploy] Failed to detach previous custom domain from Vercel:", err),
        )
      }

      const [domainResult, dnsConfig] = await Promise.all([
        addDomainToProject(projectId, cleanDomain).catch((err) => ({
          name: cleanDomain,
          verified: false,
          verificationRequired: true,
          verificationRecords: [{ type: "TXT", domain: `_vercel.${cleanDomain}`, value: "vc-domain-verify" }],
          error: err.message,
        })),
        getDomainConfig(cleanDomain).catch((err) => ({
          cname: "cname.vercel-dns.com",
          aRecord: "76.76.21.21",
          configured: false,
          error: err.message,
        })),
      ])

      await Promise.all([
        db.tenant.update({
          where: { id: tenantId },
          data: { customDomain: cleanDomain }
        }).catch(() => null),
        db.setting.upsert({
          where: { key: `${tenantId}_customDomain` },
          update: { value: cleanDomain },
          create: { tenantId, key: `${tenantId}_customDomain`, value: cleanDomain }
        })
      ])

      return NextResponse.json({
        success: true,
        domain: domainResult,
        dns: dnsConfig,
      })
    }

    // ── ACTION: VERIFY DOMAIN DNS STATUS ────────────────────────────────────
    if (action === "verify-domain") {
      const targetDomain = (domain || (tenant as any).customDomain || "").toLowerCase().trim()
      if (!targetDomain) {
        return NextResponse.json({ error: "Domain belum ditentukan" }, { status: 400 })
      }

      const dnsConfig = await getDomainConfig(targetDomain).catch((err) => ({
        cname: "cname.vercel-dns.com",
        aRecord: "76.76.21.21",
        configured: false,
        error: err.message,
      }))

      return NextResponse.json({
        success: true,
        domain: targetDomain,
        dns: dnsConfig,
        verified: (dnsConfig as any).configured ?? false,
      })
    }

    // ── ACTION: REMOVE CUSTOM DOMAIN ────────────────────────────────────────
    if (action === "remove-domain") {
      const existingProjectId = await db.setting.findUnique({ where: { key: `${tenantId}_vercelProjectId` } })
      const projectId = existingProjectId?.value || (tenant as any).vercelProjectId
      const currentDomain = (tenant as any).customDomain as string | null

      if (projectId && currentDomain) {
        await removeDomainFromProject(projectId, currentDomain).catch((err) =>
          console.warn("[deploy] Failed to detach custom domain from Vercel:", err),
        )
      }

      await Promise.all([
        db.tenant.update({
          where: { id: tenantId },
          data: { customDomain: null }
        }).catch(() => null),
        db.setting.deleteMany({
          where: { key: `${tenantId}_customDomain` }
        }).catch(() => null)
      ])

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Gunakan Deploy Production di Infrastruktur → Hosting." }, { status: 400 })
  },
  { minRole: "admin" },
)
