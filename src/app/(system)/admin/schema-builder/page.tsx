import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Schema Builder | SaCMS Admin",
  description: "Global template schemas for SaCMS",
}

import { AdminSchemaBuilderClient } from "./client"
import { db } from "@/lib/database"

export const dynamic = "force-dynamic"

export default async function AdminSchemaBuilderPage() {
  const templatesContentType = await db.contentType.findFirst({
    where: { slug: "templates", tenantId: null }
  })

  let templates: any[] = []
  if (templatesContentType) {
    const entries = await db.contentEntry.findMany({
      where: { contentTypeId: templatesContentType.id },
      orderBy: { createdAt: "desc" }
    })
    
    // We parse the JSON for safety and stringify back so it can be passed to client component
    templates = entries.map(e => ({
      id: e.id,
      createdAt: e.createdAt,
      status: e.status,
      data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    }))
  }

  return <AdminSchemaBuilderClient templates={templates} />
}
