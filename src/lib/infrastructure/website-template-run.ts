import { db } from "@/lib/database"

export type TemplateRun = { templateId: string; phase: "schema" | "deploy"; lease: string | null; expiresAt: number }

export function websiteTemplateRunKey(tenantId: string) {
  return `${tenantId}_websiteTemplateApplyRun`
}

export async function getWebsiteTemplateRun(tenantId: string): Promise<TemplateRun | null> {
  const row = await db.setting.findUnique({ where: { key: websiteTemplateRunKey(tenantId) }, select: { value: true } })
  return row ? JSON.parse(row.value) as TemplateRun : null
}
