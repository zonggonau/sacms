"use client"

import { useRouter } from "next/navigation"
import { WebsiteTemplatesTab } from "./website-templates-gallery"

export function WebsiteTemplatesClient({ tenantSlug, currentRole, planAccess, isWorkspaceEmpty }: {
  tenantSlug: string
  currentRole: string
  planAccess: "free" | "purchase" | "locked"
  isWorkspaceEmpty: boolean
}) {
  const router = useRouter()
  return (
    <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">Website Template</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Website siap pakai lengkap dengan schema CMS. Terapkan ke workspace ini, lalu sesuaikan lewat MCP dan rilis dari Hosting.
        </p>
      </div>
      <WebsiteTemplatesTab
        tenantSlug={tenantSlug}
        currentRole={currentRole}
        planAccess={planAccess}
        isWorkspaceEmpty={isWorkspaceEmpty}
        // The applied schema is shown on Diagram Schema.
        onApplied={() => router.push(`/dashboard/${tenantSlug}/developer/schema`)}
        onReset={() => router.refresh()}
      />
    </div>
  )
}
