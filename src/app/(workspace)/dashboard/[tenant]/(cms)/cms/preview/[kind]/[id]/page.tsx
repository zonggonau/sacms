import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { checkPermission, PERMISSIONS } from "@/lib/rbac"

export default async function ContentPreview({ params, searchParams }: {
  params: Promise<{ tenant: string; kind: string; id: string }>
  searchParams: Promise<{ locale?: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  const { tenant, kind, id } = await params
  const access = await getTenantAccess(session, tenant)
  if (!access || !(await checkPermission(tenant, PERMISSIONS.CONTENT_READ)).allowed) notFound()
  const tenantDb = await getTenantDb(tenant)
  const locale = (await searchParams).locale || "id"
  const item = kind === "entry"
    ? await tenantDb.contentEntry.findFirst({ where: { tenantId: access.tenantId, id, deletedAt: null }, select: { data: true, contentType: { select: { name: true } } } })
    : kind === "single" ? await tenantDb.tenantSingleTypeAssignment.findFirst({
      where: { tenantId: access.tenantId, locale, enabled: true, singleType: { slug: id, draftTemplateId: null } },
      select: { data: true, draftData: true, singleType: { select: { name: true } } },
    }) : null
  if (!item) notFound()
  return <main className="mx-auto max-w-3xl space-y-6 p-8">
    <h1 className="text-2xl font-semibold">Pratinjau {("contentType" in item ? item.contentType : item.singleType).name}</h1>
    <dl className="space-y-4">{Object.entries(("draftData" in item ? item.draftData ?? item.data : item.data) ?? {}).map(([key, value]) => <div key={key}>
      <dt className="font-medium">{key}</dt>
      <dd className="whitespace-pre-wrap break-words">{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</dd>
    </div>)}</dl>
  </main>
}
