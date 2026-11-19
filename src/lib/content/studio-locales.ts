import { db } from "@/lib/database"

export async function getStudioLocales(tenantId: string, fallback = { locale: "en", name: "English" }) {
  const locales = await db.tenantLocale.findMany({
    where: { tenantId, isEnabled: true },
    orderBy: [{ isDefault: "desc" }, { locale: "asc" }],
    select: { locale: true, name: true },
  })

  return locales.length ? locales : [fallback]
}
