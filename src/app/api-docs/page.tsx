"use client"

import dynamic from "next/dynamic"
import "swagger-ui-react/swagger-ui.css"

const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false })

export default function ApiDocs() {
  return (
    <div className="h-screen w-full bg-white">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">SaCMS Public API Documentation</h1>
        <p className="text-muted-foreground mt-2">
          Gunakan dokumentasi ini untuk mengintegrasikan SaCMS Headless API dengan aplikasi Frontend Anda.
        </p>
      </div>
      <div className="p-4">
        {/* We can load openapi.yaml directly if we expose it via public folder, but let's assume it's exposed or we can provide it inline/url */}
        {/* We'll serve the YAML from a new API route to avoid copying files to public manually */}
        <SwaggerUI url="/api/docs/openapi" />
      </div>
    </div>
  )
}
