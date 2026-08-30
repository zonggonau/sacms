"use client"

import { usePathname, useParams } from "next/navigation"
import { SupportWidget } from "@/components/support/support-widget"

interface DashboardLayoutShellProps {
  sidebar: React.ReactNode
  subscriptionGate: React.ReactNode
}

export function DashboardLayoutShell({
  sidebar,
  subscriptionGate,
}: DashboardLayoutShellProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      {sidebar}
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative pt-14 md:pt-0">
        {subscriptionGate}
      </div>
    </div>
  )
}

