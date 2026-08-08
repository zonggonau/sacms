"use client"

import { usePathname } from "next/navigation"

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
      <div className="flex-1 overflow-y-auto flex flex-col bg-background text-foreground relative">
        {subscriptionGate}
      </div>
    </div>
  )
}
