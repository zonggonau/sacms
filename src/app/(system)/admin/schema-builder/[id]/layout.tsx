import { Metadata } from "next"
import { db } from "@/lib/database"
import { notFound } from "next/navigation"
import { TemplateProvider } from "./template-context"
import Link from "next/link"
import { Layout, Settings, Component, FileText, ArrowLeft, Database, Globe } from "lucide-react"

export const metadata: Metadata = {
  title: "Template Builder | SaCMS Admin",
  description: "Visual builder for global templates",
}

export default async function TemplateBuilderLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const template = await db.contentEntry.findUnique({
    where: { id }
  })

  if (!template) {
    notFound()
  }

  let parsedData = template.data
  if (typeof template.data === 'string') {
    try {
      parsedData = JSON.parse(template.data)
    } catch (e) {
      console.error("Failed to parse template data", e)
      parsedData = {}
    }
  }

  return (
    <TemplateProvider 
      initialId={template.id} 
      initialStatus={template.status} 
      initialData={parsedData as any}
    >
      <div className="flex min-h-[calc(100vh-64px)]">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-muted/20 flex flex-col">
          <div className="p-4 border-b">
            <Link 
              href="/admin/schema-builder" 
              className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Templates
            </Link>
            <h2 className="font-semibold truncate" title={(parsedData as any)?.name || "Untitled"}>
              {(parsedData as any)?.name || "Untitled Template"}
            </h2>
            <div className="text-xs text-muted-foreground truncate mt-1 font-mono">
              {template.id}
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
            <Link 
              href={`/admin/schema-builder/${id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              <Globe className="h-4 w-4 text-muted-foreground" />
              Overview
            </Link>
            <Link 
              href={`/admin/schema-builder/${id}/content-types`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              <Database className="h-4 w-4 text-blue-500" />
              Content Types
            </Link>
            <Link 
              href={`/admin/schema-builder/${id}/single-types`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              <FileText className="h-4 w-4 text-purple-500" />
              Single Types
            </Link>
            <Link 
              href={`/admin/schema-builder/${id}/components`}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
            >
              <Component className="h-4 w-4 text-orange-500" />
              Components
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 bg-background flex flex-col h-full overflow-hidden">
          {children}
        </main>
      </div>
    </TemplateProvider>
  )
}
