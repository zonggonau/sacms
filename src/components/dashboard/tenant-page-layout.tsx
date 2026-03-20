"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { TenantSidebar } from "./tenant-sidebar"
import { ReactNode, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

interface TenantPageLayoutProps {
  children: ReactNode
  tenantSlug: string
  title?: string
  description?: string
  actions?: ReactNode
  header?: boolean
}

interface ContentType {
  id: string
  name: string
  slug: string
}

export function TenantPageLayout({
  children,
  tenantSlug,
  title,
  description,
  actions,
  header = true,
}: TenantPageLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [contentTypes, setContentTypes] = useState<ContentType[]>([])
  const [loading, setLoading] = useState(true)

  const tenants = session?.user?.tenants || []

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    async function fetchContentTypes() {
      if (!tenantSlug || !session?.user) return

      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/content-types`)
        
        if (res.ok) {
          const data = await res.json()
          setContentTypes(data || [])
        } else {
          console.error("TenantPageLayout failed to fetch content types:", res.status)
        }
      } catch (error) {
        console.error("Failed to fetch content types:", error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchContentTypes()
    }
  }, [tenantSlug, session])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      <TenantSidebar tenantSlug={tenantSlug} tenants={tenants} />
      <main className="flex-1 min-h-screen overflow-auto">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
          {header && (title || actions) && (
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                {title && <h1 className="text-xl font-bold tracking-tight">{title}</h1>}
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
              </div>
              {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  )
}