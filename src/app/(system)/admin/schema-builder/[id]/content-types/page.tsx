"use client"

import { useTemplateEditor, SchemaItem } from "../template-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, Database, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function TemplateContentTypesPage() {
  const { templateId, data, removeSchema } = useTemplateEditor()
  const router = useRouter()

  const contentTypes = data.schema_template?.contentTypes || []

  return (
    <div className="p-8 max-w-5xl space-y-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Content Types</h1>
          <p className="text-muted-foreground">
            Manage collections of repeating entries (like Articles, Products).
          </p>
        </div>
        <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
          <Link href={`/admin/schema-builder/${templateId}/content-types/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Create Content Type
          </Link>
        </Button>
      </div>

      {contentTypes.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-slate-50 text-slate-500">
          <Database className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Content Types</h3>
          <p className="text-sm mb-4">You haven't defined any content types in this template yet.</p>
          <Button variant="outline" asChild>
            <Link href={`/admin/schema-builder/${templateId}/content-types/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first one
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {contentTypes.map((ct: SchemaItem) => (
            <Card key={ct.slug} className="group hover:border-blue-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ct.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">{ct.slug}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-medium">
                  {ct.fields?.length || 0} Fields
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeSchema("contentTypes", ct.slug)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-blue-600" asChild>
                    <Link href={`/admin/schema-builder/${templateId}/content-types/${ct.slug}`}>
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
