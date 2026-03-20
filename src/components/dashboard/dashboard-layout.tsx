"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "./sidebar"
import { ReactNode, useEffect } from "react"

interface DashboardLayoutProps {
  children: ReactNode
  tenantSlug?: string
}

export function DashboardLayout({ children, tenantSlug }: DashboardLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const isSuperAdmin = session?.user?.role === "super_admin"
  const tenants = session?.user?.tenants || []

  return (
    <div className="flex h-screen overflow-hidden">
      <DashboardSidebar
        isSuperAdmin={isSuperAdmin}
        tenantSlug={tenantSlug}
        tenants={tenants}
      />
      <main className="flex-1 overflow-auto md:ml-0">
        {children}
      </main>
    </div>
  )
}
