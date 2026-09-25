import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { StandalonePreviewClient } from "./preview-client"

export default async function WebsiteBuilderPreviewPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const { tenant: tenantSlug } = await params
  const access = await getTenantAccess(session, tenantSlug)
  if (!access) redirect("/dashboard")

  const tenant = access.tenant

  let initialFiles: { name: string; content: string }[] = []
  let siteName = `${tenant.name} Website`
  try {
    const site = await db.site.findFirst({
      where: { tenantId: tenant.id },
      orderBy: { updatedAt: "desc" },
      include: { files: { orderBy: { path: "asc" } } },
    })
    if (site) {
      siteName = site.name
      if (site.files.length > 0) {
        initialFiles = site.files.map((f) => ({ name: f.path, content: f.content }))
      }
    }
  } catch {}

  const settings = await db.setting.findMany({
    where: {
      tenantId: tenant.id,
      key: { in: [`${tenant.id}_v0PreviewUrl`] },
    },
  })
  const previewUrl = settings.find((s) => s.key === `${tenant.id}_v0PreviewUrl`)?.value || null

  return (
    <StandalonePreviewClient
      tenantSlug={tenantSlug}
      tenantName={tenant.name}
      siteName={siteName}
      initialFiles={initialFiles}
      previewUrl={previewUrl}
    />
  )
}
