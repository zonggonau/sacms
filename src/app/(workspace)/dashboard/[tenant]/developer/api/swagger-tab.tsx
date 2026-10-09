"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { FileDown, Key, FileCode } from "lucide-react"
import Link from "next/link"

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { 
  ssr: false,
  loading: () => (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-60 rounded-xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
})

interface SwaggerTabProps {
  tenantSlug: string
}

export function SwaggerTab({ tenantSlug }: SwaggerTabProps) {
  const specUrl = `/api/tenant/${tenantSlug}/developer/openapi`

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Interactive OpenAPI 3.0 Documentation</span>
                <Badge variant="outline" className="text-[10px] font-bold rounded-full bg-primary/10 text-primary border-primary/20">
                  OpenAPI 3.0
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Spesifikasi live endpoint, request schema, dan status code untuk workspace <span className="font-mono font-bold text-foreground">/{tenantSlug}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold border-border/80" asChild>
              <a href={specUrl} target="_blank" rel="noreferrer" download={`openapi-${tenantSlug}.json`}>
                <FileDown className="w-3.5 h-3.5 mr-1.5 text-primary" />
                Unduh JSON
              </a>
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold border-border/80" asChild>
              <Link href={`/dashboard/${tenantSlug}/developer/api-keys`}>
                <Key className="w-3.5 h-3.5 mr-1.5 text-primary" />
                API Token
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-card dark:bg-slate-950 border border-border/80 shadow-xs rounded-2xl overflow-hidden p-3 md:p-6">
        <SwaggerUI url={specUrl} />
      </div>
    </div>
  )
}
