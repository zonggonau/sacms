"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Database, Pencil } from "lucide-react"
import { FIELD_TYPES } from "@/lib/field-types"
import type { SchemaModel, SchemaField } from "./schema-diagram"

function FieldBadge({ field }: { field: SchemaField }) {
  const meta = FIELD_TYPES.find((f) => f.type === field.type)
  const Icon = meta?.icon || Database
  return (
    <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-muted/40 border-border/70">
      <Icon className="h-3 w-3 text-muted-foreground" />
      {field.name}
      {field.required && <span className="text-primary">*</span>}
    </Badge>
  )
}

/** Shared card grid for a schema's Content Types / Single Types / Components — used by the schema page's list tabs. Read-only unless `editHrefFor` is given, which adds a per-card Edit link to the real builder page (also how a SaCMS Global template's materialized draft rows get edited). */
export function SchemaModelGrid({
  models,
  typeLabel,
  emptyMessage,
  editHrefFor,
}: {
  models: SchemaModel[]
  typeLabel: string
  emptyMessage: string
  editHrefFor?: (model: SchemaModel) => string
}) {
  if (models.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
        <Database className="h-6 w-6 opacity-50" />
        <p className="text-xs">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {models.map((model) => (
        <Card key={model.slug || model.name} className="border-border/70">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold">{model.name}</CardTitle>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant="outline" className="text-[10px] font-bold">{typeLabel}</Badge>
                {editHrefFor && (
                  <Button asChild variant="ghost" size="icon" className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                    <Link href={editHrefFor(model)} title={`Edit ${model.name}`}>
                      <Pencil className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            {model.description && <CardDescription className="text-xs">{model.description}</CardDescription>}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1.5">
              {(model.fields || []).map((f) => (
                <FieldBadge key={f.slug || f.name} field={f} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
