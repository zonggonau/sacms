import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import SingleTypeDetailClient from "./single-type-detail-client"
import { getSingleTypeBySlugAction } from "@/actions/single-types"
import { db } from "@/lib/database"

export default async function SingleTypeDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; singleTypeSlug: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect("/login")
  }

  const resolvedParams = await params
  const tenantSlug = resolvedParams.tenant
  const singleTypeSlug = resolvedParams.singleTypeSlug

  let initialSingleType: any = null
  let initialLocales = [{ locale: "en", name: "English" }]

  try {
    const stRes = await getSingleTypeBySlugAction(tenantSlug, singleTypeSlug)
    if (!stRes.error && stRes.singleType) {
      initialSingleType = stRes.singleType
    }

    // Since we're in a Server Component, we can fetch locales directly from DB
    // instead of calling the /api/tenant/:slug/locales route.
    const tenant = await db.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        locales: { orderBy: { isDefault: 'desc' } }
      }
    })

    if (tenant && tenant.locales && tenant.locales.length > 0) {
      initialLocales = tenant.locales.map(l => ({
        locale: l.locale,
        name: l.name,
        isDefault: l.isDefault
      }))
    }
  } catch (error) {
    console.error("Failed to fetch single type for detail page:", error)
  }

  return (
    <SingleTypeDetailClient
      tenantSlug={tenantSlug}
      singleTypeSlug={singleTypeSlug}
      initialSingleType={initialSingleType}
      initialLocales={initialLocales}
    />
  )
}
