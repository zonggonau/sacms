import { afterAll, describe, expect, it, vi } from "vitest"
import { db, getTenantDb, PrismaClient } from "@/lib/database"
import { applyPaymentOutcome } from "@/lib/billing/payment-success"
import { generateMonthlyInvoices } from "@/lib/billing/generate-invoices"
import { applyWebsiteTemplateToTenant } from "@/lib/infrastructure/apply-website-template"
import { deployTenantFrontend } from "@/lib/infrastructure/deploy-frontend"
import { ensureSiteSettings } from "@/lib/infrastructure/site-settings"
import { publishScheduledContent } from "@/lib/content/scheduled-publishing"

vi.mock("@/lib/webhooks", () => ({
  triggerWebhooks: vi.fn(async () => undefined),
  WebhookEvents: { CONTENT_PUBLISHED: "content.published" },
}))
vi.mock("@/lib/audit-log", () => ({
  logAudit: vi.fn(),
  AuditAction: { SETTINGS_UPDATED: "settings_updated" },
}))
vi.mock("@/lib/cache", () => ({ invalidatePattern: vi.fn(async () => undefined) }))
vi.mock("@/lib/infrastructure/deploy-frontend", () => ({ deployTenantFrontend: vi.fn() }))
vi.mock("@/lib/infrastructure/frontend-env", () => ({
  resolveApiOrigin: () => "https://example.test",
  resolveWebsiteTemplateEnvVars: async () => [],
  getTenantCustomEnvVarList: async () => [],
  setTenantCustomEnvVars: async () => undefined,
}))

function ciDatabase(raw: string | undefined, database: string) {
  if (!raw || process.env.SACMS_WORKFLOW_CI !== "1") throw new Error("Run with the disposable CI databases.")
  const parsed = new URL(raw)
  if (parsed.hostname !== "127.0.0.1" || parsed.pathname !== `/${database}`) {
    throw new Error("Integration test databases must match the disposable loopback configuration.")
  }
  return raw
}

ciDatabase(process.env.DATABASE_URL, "sacms_workflow_ci")
const dedicatedUrl = ciDatabase(process.env.SACMS_DEDICATED_CI_DATABASE_URL, "sacms_dedicated_ci")
const dedicated = new PrismaClient({ datasources: { db: { url: dedicatedUrl } } })

afterAll(async () => {
  await Promise.all([db.$disconnect(), dedicated.$disconnect()])
})

describe("critical SaCMS workflows against PostgreSQL", () => {
  it("publishes the scheduled entry from each workspace's configured database", async () => {
    const shared = await db.tenant.create({ data: { name: "Shared CI", slug: "shared-ci", useOwnerInfra: false } })
    const owner = await db.tenant.create({ data: { name: "Dedicated CI", slug: "dedicated-ci", databaseUrl: dedicatedUrl } })
    await dedicated.tenant.create({ data: { id: owner.id, name: owner.name, slug: owner.slug } })

    for (const tenant of [shared, owner]) {
      const client = await getTenantDb(tenant.slug)
      const model = await client.contentType.create({
        data: { tenantId: tenant.id, name: "Posts", slug: "posts" },
      })
      await client.contentEntry.create({
        data: {
          tenantId: tenant.id, contentTypeId: model.id, data: { title: tenant.name },
          status: "SCHEDULED", scheduledAt: new Date(Date.now() - 60_000),
        },
      })
    }

    const result = await publishScheduledContent()
    expect(result.details).toMatchObject({ [shared.slug]: 1, [owner.slug]: 1 })
    expect(await dedicated.contentEntry.count({ where: { tenantId: owner.id, status: "PUBLISHED" } })).toBe(1)
    expect(await db.contentEntry.count({ where: { tenantId: owner.id } })).toBe(0)
  })

  it("rolls back benefits on an invoice failure and delivers them exactly once after retry", async () => {
    const user = await db.user.create({ data: { email: "billing-ci@example.test" } })
    const tenant = await db.tenant.create({ data: { name: "Payment CI", slug: "payment-ci", useOwnerInfra: false } })
    const subscription = await db.subscription.create({ data: {
      userId: user.id, tenantId: tenant.id, plan: "pro",
    } })
    const payment = await db.paymentTransaction.create({ data: {
      orderId: "ADD-CI-RETRY", status: "pending", amount: 17001, subscriptionId: subscription.id,
      rawResponse: { addonId: "topup_api_500k" },
    } })

    await db.$executeRaw`ALTER TABLE "invoices" ADD CONSTRAINT ci_invoice_failure CHECK ("amount" <> 17001)`
    try {
      await expect(applyPaymentOutcome(payment.orderId, "success")).rejects.toThrow()
      expect(await db.paymentTransaction.findUnique({ where: { id: payment.id } }))
        .toMatchObject({ status: "success", fulfillmentStatus: "pending" })
      expect(await db.tenant.findUnique({ where: { id: tenant.id } })).toMatchObject({ apiCallsExtra: 0 })
    } finally {
      await db.$executeRaw`ALTER TABLE "invoices" DROP CONSTRAINT ci_invoice_failure`
    }

    await Promise.all([applyPaymentOutcome(payment.orderId, "success"), applyPaymentOutcome(payment.orderId, "success")])
    expect(await db.tenant.findUnique({ where: { id: tenant.id } })).toMatchObject({ apiCallsExtra: 500_000 })
    expect(await db.invoice.count({ where: { subscriptionId: subscription.id } })).toBe(1)
  })

  it("generates one account renewal invoice when billing cron runs overlap", async () => {
    const user = await db.user.create({ data: { email: "renewal-ci@example.test" } })
    const periodEnd = new Date(Date.now() - 60_000)
    const subscription = await db.subscription.create({
      data: { userId: user.id, plan: "pro", status: "active", currentPeriodEnd: periodEnd },
    })

    await Promise.all([generateMonthlyInvoices(), generateMonthlyInvoices()])

    const invoices = await db.invoice.findMany({ where: { subscriptionId: subscription.id } })
    expect(invoices).toHaveLength(1)
    expect(invoices[0]).toMatchObject({ status: "pending", amount: expect.any(Number) })
    expect(invoices[0].amount).toBeGreaterThan(0)
    const renewed = await db.subscription.findUniqueOrThrow({ where: { id: subscription.id } })
    expect(renewed.currentPeriodStart).toEqual(periodEnd)
    expect(renewed.currentPeriodEnd!.getTime()).toBeGreaterThan(periodEnd.getTime())
  })

  it("applies a website template in a provisioned workspace and resumes after deploy failure", async () => {
    const tenant = await db.tenant.create({ data: { name: "Template CI", slug: "template-ci", useOwnerInfra: false } })
    await ensureSiteSettings(tenant.id, tenant.name)
    const schemaTemplate = await db.schemaTemplate.create({ data: {
      name: "Catalog CI", slug: "catalog-ci", category: "Test",
      schema: {
        contentTypes: [{ name: "Posts", slug: "posts", fields: [] }],
        singleTypes: [{ name: "Site Settings", slug: "site-settings", fields: [{ name: "Contact", slug: "contact", type: "text" }] }],
      },
    } })
    const template = await db.websiteTemplate.create({
      data: {
        name: "Website CI", slug: "website-ci", schemaTemplateId: schemaTemplate.id,
        files: [{ path: "app/page.tsx", content: "export default function Page() { return null }" }],
      },
      include: { schemaTemplate: true },
    })
    vi.mocked(deployTenantFrontend).mockRejectedValueOnce(new Error("hosting failure"))
      .mockResolvedValueOnce({ deploymentId: "fixture", url: "https://example.test", state: "READY", apiKeyName: "test", simulated: false })

    await expect(applyWebsiteTemplateToTenant(tenant.id, tenant.slug, template)).rejects.toThrow("hosting failure")
    const result = await applyWebsiteTemplateToTenant(tenant.id, tenant.slug, template)
    expect(result).toMatchObject({ ok: true, imported: 0 })
    expect(await db.tenant.findUnique({ where: { id: tenant.id } })).toMatchObject({ sourceWebsiteTemplateId: template.id })
    const settings = await db.singleType.findFirstOrThrow({ where: { tenantId: tenant.id, slug: "site-settings" } })
    expect(await db.schemaField.count({ where: { singleTypeId: settings.id, slug: "contact" } })).toBe(1)
    expect(await db.tenantSingleTypeAssignment.findFirst({ where: { singleTypeId: settings.id } }))
      .toMatchObject({ data: { "brand-name": tenant.name } })
  })
})
