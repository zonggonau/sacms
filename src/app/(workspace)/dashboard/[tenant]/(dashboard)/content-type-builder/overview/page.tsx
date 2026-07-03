"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Sparkles, Layout, FileText, Puzzle, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
import { aiTemplates } from "@/lib/ai-templates"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export default function OverviewPage() {
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [isAIModalOpen, setIsAIModalOpen] = useState(false)
  const [modalType, setModalType] = useState<"schema" | "single-type" | "component">("schema")
  const [initialPrompt, setInitialPrompt] = useState("")

  const openGenerator = (type: "schema" | "single-type" | "component", prompt: string = "") => {
    setModalType(type)
    setInitialPrompt(prompt)
    setIsAIModalOpen(true)
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-[#f6f6f9] text-foreground flex flex-col w-full">
        <div className="p-6 lg:p-8 w-full space-y-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Content Type Builder Overview</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Design and architect your database schemas visually or generate them instantly with AI.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-none shadow-none"
                onClick={() => openGenerator("schema")}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Custom AI Generate
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Collection Types</p>
                  <p className="text-sm font-medium text-slate-600">Schemas with multiple entries</p>
                </div>
                <div className="w-12 h-12 rounded-none bg-blue-50 flex items-center justify-center text-blue-500">
                  <Layout className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Single Types</p>
                  <p className="text-sm font-medium text-slate-600">One-off pages & configurations</p>
                </div>
                <div className="w-12 h-12 rounded-none bg-emerald-50 flex items-center justify-center text-emerald-500">
                  <FileText className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border border-slate-200 rounded-none shadow-sm">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Components</p>
                  <p className="text-sm font-medium text-slate-600">Reusable content blocks</p>
                </div>
                <div className="w-12 h-12 rounded-none bg-purple-50 flex items-center justify-center text-purple-500">
                  <Puzzle className="h-6 w-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Templates Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">AI Templates</h2>
              <p className="text-sm text-slate-500">Click any template to instantly generate its schema structure using AI.</p>
            </div>

            <Tabs defaultValue="schema" className="w-full">
              <TabsList className="bg-white border border-slate-200 p-0 rounded-none h-12 inline-flex mb-4">
                <TabsTrigger value="schema" className="rounded-none data-[state=active]:bg-slate-100 h-full px-6 font-semibold">
                  Collection Types <Badge variant="secondary" className="ml-2 bg-slate-200">{aiTemplates.schema.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="single-type" className="rounded-none data-[state=active]:bg-slate-100 h-full px-6 font-semibold">
                  Single Types <Badge variant="secondary" className="ml-2 bg-slate-200">{aiTemplates["single-type"].length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="component" className="rounded-none data-[state=active]:bg-slate-100 h-full px-6 font-semibold">
                  Components <Badge variant="secondary" className="ml-2 bg-slate-200">{aiTemplates.component.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="schema" className="m-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {aiTemplates.schema.map((template, idx) => (
                    <Card 
                      key={idx} 
                      className="bg-white border border-slate-200 rounded-none shadow-sm hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => openGenerator("schema", template.prompt)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                          {template.label}
                          <Sparkles className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-3 mt-2 leading-relaxed">
                          {template.prompt}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="single-type" className="m-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {aiTemplates["single-type"].map((template, idx) => (
                    <Card 
                      key={idx} 
                      className="bg-white border border-slate-200 rounded-none shadow-sm hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => openGenerator("single-type", template.prompt)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                          {template.label}
                          <Sparkles className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-3 mt-2 leading-relaxed">
                          {template.prompt}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="component" className="m-0 focus-visible:ring-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {aiTemplates.component.map((template, idx) => (
                    <Card 
                      key={idx} 
                      className="bg-white border border-slate-200 rounded-none shadow-sm hover:border-orange-300 hover:shadow-md transition-all cursor-pointer group"
                      onClick={() => openGenerator("component", template.prompt)}
                    >
                      <CardHeader className="p-4">
                        <CardTitle className="text-sm font-bold flex items-center justify-between">
                          {template.label}
                          <Sparkles className="h-4 w-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-3 mt-2 leading-relaxed">
                          {template.prompt}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>

        </div>
      </div>

      <SchemaGeneratorDialog
        tenantSlug={tenantSlug}
        type={modalType}
        open={isAIModalOpen}
        onOpenChange={setIsAIModalOpen}
        initialPrompt={initialPrompt}
      />
    </div>
  )
}
