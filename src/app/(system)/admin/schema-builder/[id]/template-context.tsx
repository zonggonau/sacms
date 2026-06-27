"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { useToast } from "@/hooks/use-toast"
import { updateTemplateAction } from "../actions"
import { useRouter } from "next/navigation"

export type SchemaItem = {
  name: string
  slug: string
  description?: string
  fields: any[]
}

export type TemplateData = {
  schema_template?: {
    contentTypes?: SchemaItem[]
    singleTypes?: SchemaItem[]
    components?: SchemaItem[]
  }
  [key: string]: any
}

type TemplateContextType = {
  templateId: string
  status: string
  data: TemplateData
  updateSchema: (type: "contentTypes" | "singleTypes" | "components", schema: SchemaItem) => void
  removeSchema: (type: "contentTypes" | "singleTypes" | "components", slug: string) => void
  saveTemplate: () => Promise<void>
  publishTemplate: () => Promise<void>
  isSaving: boolean
}

const TemplateContext = createContext<TemplateContextType | null>(null)

export function TemplateProvider({ 
  children, 
  initialId, 
  initialStatus, 
  initialData 
}: { 
  children: ReactNode, 
  initialId: string,
  initialStatus: string,
  initialData: TemplateData
}) {
  const [data, setData] = useState<TemplateData>(initialData)
  const [status, setStatus] = useState(initialStatus)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const updateSchema = (type: "contentTypes" | "singleTypes" | "components", schema: SchemaItem) => {
    setData(prev => {
      const next = { ...prev }
      if (!next.schema_template) next.schema_template = {}
      if (!next.schema_template[type]) next.schema_template[type] = []

      const list = [...next.schema_template[type]!]
      const index = list.findIndex(s => s.slug === schema.slug)
      
      if (index >= 0) {
        list[index] = schema
      } else {
        list.push(schema)
      }
      
      next.schema_template[type] = list
      return next
    })
  }

  const removeSchema = (type: "contentTypes" | "singleTypes" | "components", slug: string) => {
    setData(prev => {
      const next = { ...prev }
      if (!next.schema_template?.[type]) return next
      
      next.schema_template[type] = next.schema_template[type]!.filter(s => s.slug !== slug)
      return next
    })
  }

  const saveTemplate = async () => {
    setIsSaving(true)
    const res = await updateTemplateAction(initialId, data)
    if (res?.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
    } else {
      toast({ title: "Success", description: "Template saved successfully" })
      router.refresh()
    }
    setIsSaving(false)
  }

  const publishTemplate = async () => {
    setIsSaving(true)
    const res = await updateTemplateAction(initialId, data, "PUBLISHED")
    if (res?.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" })
    } else {
      setStatus("PUBLISHED")
      toast({ title: "Success", description: "Template published successfully" })
      router.refresh()
    }
    setIsSaving(false)
  }

  return (
    <TemplateContext.Provider value={{ 
      templateId: initialId, 
      status,
      data, 
      updateSchema, 
      removeSchema, 
      saveTemplate,
      publishTemplate,
      isSaving 
    }}>
      {children}
    </TemplateContext.Provider>
  )
}

export function useTemplateEditor() {
  const context = useContext(TemplateContext)
  if (!context) throw new Error("useTemplateEditor must be used within a TemplateProvider")
  return context
}
