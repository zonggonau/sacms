import { db } from "@/lib/database"

/**
 * A tenant's AI-builder v0 chat id is stored in Setting["<tenantId>_v0ChatId"],
 * and any per-site conversation lives under a Site owned by the tenant. The
 * ai-builder routes take `chatId` straight from the URL, so without this check
 * a workspace admin could preview / iterate / read another tenant's generated
 * site by passing its chat id.
 */
export async function chatBelongsToTenant(chatId: string, tenantId: string): Promise<boolean> {
  if (!chatId) return false

  const primary = await db.setting.findUnique({
    where: { key: `${tenantId}_v0ChatId` },
    select: { value: true },
  })
  if (primary?.value === chatId) return true

  // Fall back to a SiteConversation whose Site is this tenant's.
  const conv = await db.siteConversation.findFirst({
    where: { id: chatId, site: { tenantId } },
    select: { id: true },
  })
  return Boolean(conv)
}
