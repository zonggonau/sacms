"use client"

import { useTemplateEditor, SchemaItem } from "../template-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Plus, FileText, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"

export default function TemplateSingleTypesPage() {
  const { templateId, data, removeSchema } = useTemplateEditor()
  const singleTypes = data.schema_template?.singleTypes || []

  return (
    <div className="p-8 max-w-5xl space-y-8 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Single Types</h1>
          <p className="text-muted-foreground">
            Manage unique entries that only have one instance (like a Homepage or Settings).
          </p>
        </div>
        <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm">
          <Link href={`/admin/schema-builder/${templateId}/single-types/new`}>
            <Plus className="h-4 w-4 mr-2" />
            Create Single Type
          </Link>
        </Button>
      </div>

      {singleTypes.length === 0 ? (
        <div className="text-center p-12 border-2 border-dashed rounded-xl bg-slate-50 text-slate-500">
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No Single Types</h3>
          <p className="text-sm mb-4">You haven't defined any single types in this template yet.</p>
          <Button variant="outline" asChild>
            <Link href={`/admin/schema-builder/${templateId}/single-types/new`}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first one
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {singleTypes.map((st: SchemaItem) => (
            <Card key={st.slug} className="group hover:border-purple-400 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-md">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{st.name}</CardTitle>
                      <CardDescription className="text-xs font-mono">{st.slug}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-2 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground font-medium">
                  {st.fields?.length || 0} Fields
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeSchema("singleTypes", st.slug)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-purple-600" asChild>
                    <Link href={`/admin/schema-builder/${templateId}/single-types/${st.slug}`}>
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
