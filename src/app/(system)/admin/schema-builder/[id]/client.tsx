"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { updateTemplateAction } from "../actions"
import { ArrowLeft, Save, Send, Settings, FileText, Component, Braces } from "lucide-react"
import Link from "next/link"

export function AdminTemplateEditorClient({ template }: { template: any }) {
  const router = useRouter()
  const { toast } = useToast()
  
  // Local state for the entire template data
  const [localData, setLocalData] = useState<any>(template.data || {})
  const [isSaving, setIsSaving] = useState(false)

  // Dialog state for editing a specific JSON snippet
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ type: string; index: number; name: string } | null>(null)
  const [jsonInput, setJsonInput] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  const schemaTemplate = localData.schema_template || { contentTypes: [], singleTypes: [], components: [] }

  const handleSaveTemplate = async (publish = false) => {
    setIsSaving(true)
    const newStatus = publish ? "PUBLISHED" : undefined
    const res = await updateTemplateAction(template.id, localData, newStatus)
    
    if (res?.error) {
      toast({
        title: "Error",
        description: res.error,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Success",
        description: publish ? "Template published successfully" : "Template saved successfully"
      })
      if (publish) {
        // Option to redirect to dashboard templates if we want
        router.refresh()
      }
    }
    setIsSaving(false)
  }

  const openEditor = (type: string, index: number, name: string, data: any) => {
    setEditingItem({ type, index, name })
    setJsonInput(JSON.stringify(data, null, 2))
    setJsonError(null)
    setEditDialogOpen(true)
  }

  const saveJsonEdit = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      if (!editingItem) return

      const updatedData = { ...localData }
      if (!updatedData.schema_template) updatedData.schema_template = {}
      if (!updatedData.schema_template[editingItem.type]) updatedData.schema_template[editingItem.type] = []

      updatedData.schema_template[editingItem.type][editingItem.index] = parsed
      setLocalData(updatedData)
      setEditDialogOpen(false)
    } catch (e: any) {
      setJsonError("Invalid JSON: " + e.message)
    }
  }

  const renderList = (items: any[], typeKey: string, icon: React.ReactNode) => {
    if (!items || items.length === 0) {
      return <div className="text-muted-foreground p-8 text-center border border-dashed rounded-lg">No items defined in this template.</div>
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <Card key={index} className="flex flex-col group transition-all hover:border-orange-500 hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-muted rounded-md">{icon}</div>
                <div>
                  <CardTitle className="text-base">{item.name || "Unnamed"}</CardTitle>
                  <CardDescription className="text-xs font-mono">{item.slug || "No slug"}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="mt-auto pt-4 border-t flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={() => openEditor(typeKey, index, item.name || "Unnamed", item)}
              >
                <Braces className="mr-2 h-4 w-4" />
                Edit JSON
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Link href="/admin/schema-builder" className="hover:text-foreground transition-colors flex items-center">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Schema Builder
            </Link>
          </div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            {localData.name || "Untitled Template"}
            <span className={`text-xs font-mono px-2 py-1 rounded-full border ${template.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
              {template.status}
            </span>
          </h2>
          <p className="text-muted-foreground mt-1">{localData.description || "No description provided."}</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSaveTemplate(false)} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button 
            className="bg-orange-500 hover:bg-orange-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all rounded-none"
            onClick={() => handleSaveTemplate(true)} 
            disabled={isSaving}
          >
            <Send className="mr-2 h-4 w-4" />
            Publish Template
          </Button>
        </div>
      </div>

      <Tabs defaultValue="collections" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="singles">Singles</TabsTrigger>
          <TabsTrigger value="components">Components</TabsTrigger>
        </TabsList>
        <TabsContent value="collections" className="mt-6">
          {renderList(schemaTemplate.contentTypes, "contentTypes", <FileText className="h-5 w-5 text-blue-500" />)}
        </TabsContent>
        <TabsContent value="singles" className="mt-6">
          {renderList(schemaTemplate.singleTypes, "singleTypes", <Settings className="h-5 w-5 text-purple-500" />)}
        </TabsContent>
        <TabsContent value="components" className="mt-6">
          {renderList(schemaTemplate.components, "components", <Component className="h-5 w-5 text-orange-500" />)}
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editing {editingItem?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 min-h-[400px] flex flex-col py-4">
            {jsonError && (
              <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-md mb-4 text-sm font-mono">
                {jsonError}
              </div>
            )}
            <Textarea
              className="flex-1 font-mono text-sm resize-none"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              spellCheck={false}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveJsonEdit}>Apply Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
