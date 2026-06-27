"use client"

import { useTemplateEditor } from "./template-context"
import { Button } from "@/components/ui/button"
import { Save, Send, ShieldAlert, CheckCircle2 } from "lucide-react"

export default function TemplateOverviewPage() {
  const { status, data, saveTemplate, publishTemplate, isSaving } = useTemplateEditor()

  const isPublished = status === "PUBLISHED"

  return (
    <div className="p-8 max-w-4xl space-y-8 overflow-y-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Template Overview</h1>
        <p className="text-muted-foreground">
          Manage the global schema template settings and publish status.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              Template Information
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Name</div>
                <div className="font-medium">{data.name || "Untitled Template"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <div className="text-sm">{data.description || "No description provided"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border bg-white shadow-sm">
                  {isPublished ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span className="text-emerald-700">Published</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-amber-700">Draft</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Schema Summary</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">
                  {data.schema_template?.contentTypes?.length || 0}
                </div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wider mt-1">Collections</div>
              </div>
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                <div className="text-2xl font-bold text-purple-700">
                  {data.schema_template?.singleTypes?.length || 0}
                </div>
                <div className="text-xs text-purple-600 font-medium uppercase tracking-wider mt-1">Singles</div>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                <div className="text-2xl font-bold text-orange-700">
                  {data.schema_template?.components?.length || 0}
                </div>
                <div className="text-xs text-orange-600 font-medium uppercase tracking-wider mt-1">Components</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-semibold mb-4">Actions</h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-lg border bg-slate-50 flex items-start gap-4">
                <div className="mt-0.5 p-2 bg-white rounded-md border shadow-sm">
                  <Save className="h-5 w-5 text-slate-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium">Save Draft</h4>
                  <p className="text-xs text-muted-foreground mt-1 mb-3">
                    Save your schema changes without publishing them to workspaces.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={saveTemplate} 
                    disabled={isSaving}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 flex items-start gap-4">
                <div className="mt-0.5 p-2 bg-white rounded-md border border-orange-100 shadow-sm">
                  <Send className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-orange-900">Publish Template</h4>
                  <p className="text-xs text-orange-700/80 mt-1 mb-3">
                    Make this template available for users to select when creating new workspaces.
                  </p>
                  <Button 
                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all rounded-none"
                    size="sm"
                    onClick={publishTemplate} 
                    disabled={isSaving || isPublished}
                  >
                    {isPublished ? "Already Published" : "Publish Now"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
