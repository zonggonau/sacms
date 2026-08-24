"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, GripVertical, Loader2, ListPlus } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { ComponentField } from "./component-field"
import { Label } from "@/components/ui/label"

interface ComponentDefinition {
  id: string
  name: string
  slug: string
  // we just need id, name, slug to show the dropdown
}

interface DynamicZoneFieldProps {
  tenantSlug: string
  value: any[]
  onChange: (val: any[]) => void
  label: React.ReactNode
  allowedComponents?: string[] // Optional array of allowed component slugs. If empty/undefined, allow all.
}

export function DynamicZoneField({
  tenantSlug,
  value,
  onChange,
  label,
  allowedComponents
}: DynamicZoneFieldProps) {
  const [components, setComponents] = useState<ComponentDefinition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchComponents() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/components`)
        if (res.ok) {
          let data: ComponentDefinition[] = await res.json()
          if (allowedComponents && allowedComponents.length > 0) {
            data = data.filter(c => allowedComponents.includes(c.slug))
          }
          setComponents(data)
        }
      } catch (err) {
        console.error("Failed to fetch components:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchComponents()
  }, [tenantSlug, allowedComponents])

  const items = Array.isArray(value) ? value : []

  const handleAddComponent = (componentSlug: string) => {
    const newItem = { __component: componentSlug }
    onChange([...items, newItem])
  }

  const handleRemoveComponent = (index: number) => {
    const newItems = [...items]
    newItems.splice(index, 1)
    onChange(newItems)
  }

  const handleItemChange = (index: number, newValue: any) => {
    const newItems = [...items]
    // Make sure we keep __component
    newItems[index] = { ...newValue, __component: items[index].__component }
    onChange(newItems)
  }

  if (loading) {
    return (
      <div className="border rounded-md p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading dynamic zone...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {label && <Label className="font-bold text-slate-700">{label}</Label>}
      
      <div className="space-y-4">
        {items.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center bg-muted/10">
            <ListPlus className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-medium text-foreground">No components added</h3>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Add a component to build this dynamic zone.
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs font-semibold cursor-pointer">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Tambah Komponen
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-56 rounded-xl">
                {components.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">Komponen tidak tersedia</div>
                ) : (
                  components.map(comp => (
                    <DropdownMenuItem 
                      key={comp.id} 
                      onClick={() => handleAddComponent(comp.slug)}
                      className="cursor-pointer rounded-lg text-xs font-medium"
                    >
                      {comp.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item, index) => {
              const compDef = components.find(c => c.slug === item.__component)
              const compName = compDef ? compDef.name : item.__component

              return (
                <div key={index} className="flex gap-2 items-start relative group">
                  <div className="mt-4 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6 cursor-grab text-muted-foreground">
                      <GripVertical className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs relative">
                    <div className="absolute top-2 right-2 z-10">
                       <Button 
                        variant="destructive" 
                        size="icon" 
                        className="h-7 w-7 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => handleRemoveComponent(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <ComponentField 
                      tenantSlug={tenantSlug} 
                      componentSlug={item.__component} 
                      value={item} 
                      onChange={(v) => handleItemChange(index, v)} 
                      label={
                        <div className="flex items-center text-primary">
                          <span className="uppercase text-[10px] tracking-wider font-bold">{compName}</span>
                        </div>
                      }
                      repeatable={false} 
                    />
                  </div>
                </div>
              )
            })}

            <div className="flex justify-center pt-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="w-full border-dashed border-border/80 bg-muted/10 hover:bg-muted/30 rounded-2xl py-6 cursor-pointer">
                    <Plus className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="text-muted-foreground font-semibold text-xs">Tambah ke Dynamic Zone</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64 rounded-xl">
                  {components.length === 0 ? (
                    <div className="p-2 text-xs text-muted-foreground text-center">Komponen tidak tersedia</div>
                  ) : (
                    components.map(comp => (
                      <DropdownMenuItem 
                        key={comp.id} 
                        onClick={() => handleAddComponent(comp.slug)}
                        className="cursor-pointer rounded-lg text-xs font-medium"
                      >
                        {comp.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
