import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect, notFound } from "next/navigation"
import { AdminContentEntriesManager } from "@/components/admin-cms/admin-content-entries-manager"

export default async function AdminCMSContentTypeEntriesPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== "super_admin") redirect("/login")

  const { slug: contentTypeSlug } = await params

  const contentType = await db.contentType.findFirst({
    where: { slug: contentTypeSlug, tenantId: null },
    include: { schemaFields: { orderBy: { order: 'asc' } } },
  })

  if (!contentType) notFound()
  
  const mappedContentType = {
    ...contentType,
    fields: contentType.schemaFields.map(f => {
      let parsedOptions = f.options
      if (typeof f.options === 'string') {
        try { parsedOptions = JSON.parse(f.options) } catch { parsedOptions = {} }
      }
      return { ...f, options: parsedOptions || {} }
    })
  }

  const entries = await db.contentEntry.findMany({
    where: {
      contentTypeId: contentType.id,
      tenantId: null,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const parsedEntries = entries.map((e) => {
    let parsedData = e.data
    if (typeof e.data === 'string') {
      try { parsedData = JSON.parse(e.data) } catch (err) { parsedData = {} }
    }
    return {
      ...e,
      data: parsedData,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      publishedAt: e.publishedAt ? e.publishedAt.toISOString() : null,
      scheduledAt: e.scheduledAt ? e.scheduledAt.toISOString() : null,
    }
  })

  return (
    <AdminContentEntriesManager 
      contentType={mappedContentType}
      initialEntries={parsedEntries}
      contentTypeSlug={contentTypeSlug}
    />
  )
}
