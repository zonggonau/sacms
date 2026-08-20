"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Key, Webhook, Play, BookOpen, ArrowLeft, Plug } from "lucide-react"
import { NestedSidebarHeader } from "@/components/dashboard/nested-sidebar-header"

interface DeveloperSidebarProps {
  tenantId: string
}

export function DeveloperSidebar({ tenantId }: DeveloperSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { title: "API Keys", href: `/dashboard/${tenantId}/developer/api-keys`, icon: Key },
    { title: "Webhooks", href: `/dashboard/${tenantId}/developer/webhooks`, icon: Webhook },
    { title: "REST API", href: `/dashboard/${tenantId}/developer/api`, icon: Play },
    { title: "GraphQL Explorer", href: `/dashboard/${tenantId}/developer/graphql`, icon: Play },
    { title: "SDK & Docs", href: `/dashboard/${tenantId}/developer/sdk`, icon: BookOpen },
    { title: "MCP Server", href: `/dashboard/${tenantId}/developer/mcp`, icon: Plug },
  ]

  return (
    <div className="w-64 border-r border-border/80 bg-card shrink-0 hidden md:block h-full">
      <NestedSidebarHeader tenantId={tenantId} logoHref={`/dashboard/${tenantId}/developer`} />
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Link key={item.title} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.title}</span>
              </div>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
