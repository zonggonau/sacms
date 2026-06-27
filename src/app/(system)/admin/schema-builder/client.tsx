"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { SchemaGeneratorDialog } from "@/components/cms/schema-generator-dialog"
import { deleteTemplateAction } from "./actions"
import { MoreHorizontal, Trash, Pencil } from "lucide-react"
import Link from "next/link"

import * as Icons from "lucide-react"

export function AdminSchemaBuilderClient({ templates = [] }: { templates?: any[] }) {
  const [isAIOpen, setIsAIOpen] = useState(false)
  const { toast } = useToast()

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return
    
    const res = await deleteTemplateAction(id)
    if (res?.error) {
      toast({
        title: "Error",
        description: res.error,
        variant: "destructive"
      })
    } else {
      toast({
        title: "Success",
        description: "Template deleted successfully"
      })
    }
  }

  return (
    <>
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">Schema Builder</h2>
          <Button 
            onClick={() => setIsAIOpen(true)}
            className="rounded-none bg-orange-500 hover:bg-orange-600 text-white font-bold tracking-widest uppercase transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            AI Builder
          </Button>
        </div>
        {templates.length === 0 ? (
          <div className="flex h-[400px] shrink-0 items-center justify-center rounded-md border border-dashed">
            <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
              <h3 className="mt-4 text-lg font-semibold">Global Schema Templates</h3>
              <p className="mb-4 mt-2 text-sm text-muted-foreground">
                Create global schemas that can be used by tenants as starting points. Click the AI Builder button to generate a schema.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Name & Description</TableHead>
                  <TableHead>Template ID</TableHead>
                  <TableHead className="text-right">Schema Breakdown</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((tpl: any) => {
                  const IconComp = (Icons as any)[tpl.data.icon || 'FileCode2'] || Icons.FileCode2
                  
                  return (
                    <TableRow key={tpl.id}>
                      <TableCell>
                        <div className="w-10 h-10 bg-orange-100 text-orange-600 flex items-center justify-center rounded-md">
                          <IconComp className="h-5 w-5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-base">{tpl.data.name}</div>
                        <div className="text-sm text-muted-foreground">{tpl.data.description}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {tpl.data.template_id}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-xs font-medium">
                            {tpl.data.schema_template?.contentTypes?.length || 0} Collections
                          </div>
                          <div className="text-xs font-medium">
                            {tpl.data.schema_template?.singleTypes?.length || 0} Singles
                          </div>
                          <div className="text-xs font-medium">
                            {tpl.data.schema_template?.components?.length || 0} Components
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/admin/schema-builder/${tpl.id}`} className="cursor-pointer">
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit Schema
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive focus:text-destructive cursor-pointer"
                              onClick={() => handleDelete(tpl.id)}
                            >
                              <Trash className="mr-2 h-4 w-4" />
                              Delete Template
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <SchemaGeneratorDialog
        type="system"
        open={isAIOpen}
        onOpenChange={setIsAIOpen}
      />
    </>
  )
}
