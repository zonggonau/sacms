"use client"

import dynamic from "next/dynamic"
import { useParams } from "next/navigation"
import "swagger-ui-react/swagger-ui.css"
import { Loader2 } from "lucide-react"

// Import swagger UI dynamically to avoid SSR issues with window object
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { 
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
})

export default function APIDocsPage() {
  const params = useParams()
  const tenantSlug = params?.tenant as string

  if (!tenantSlug) return null

  // The dynamic OpenAPI JSON generator endpoint
  const specUrl = `/api/tenant/${tenantSlug}/developer/openapi`

  return (
    <div className="flex-1 bg-white min-h-screen">
      <div className="p-6 lg:p-8 border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">API Documentation</h1>
          <p className="text-muted-foreground font-medium mt-1">Interactive REST API Reference for your Headless CMS</p>
        </div>
      </div>
      <div className="p-0 lg:p-4 bg-[#f6f6f9]">
        <div className="max-w-7xl mx-auto bg-white border border-slate-200 shadow-sm rounded-none overflow-hidden">
          <SwaggerUI url={specUrl} />
        </div>
      </div>
    </div>
  )
}
