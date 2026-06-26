"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Key, Webhook, Play, BookOpen, ArrowLeft } from "lucide-react"

interface DeveloperSidebarProps {
  tenantId: string
}

export function DeveloperSidebar({ tenantId }: DeveloperSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { title: "API Tokens", href: `/dashboard/${tenantId}/developer/api-keys`, icon: Key },
    { title: "Webhooks", href: `/dashboard/${tenantId}/developer/webhooks`, icon: Webhook },
    { title: "GraphQL Explorer", href: `/dashboard/${tenantId}/developer/graphql`, icon: Play },
    { title: "REST API", href: `/dashboard/${tenantId}/developer/api`, icon: Play },
    { title: "SDK & Docs", href: `/dashboard/${tenantId}/developer/sdk`, icon: BookOpen },
  ]

  return (
    <div className="w-64 border-r bg-background shrink-0 hidden md:block">
      <div className="p-4 border-b">
        <Link 
          href={`/dashboard/${tenantId}`}
          className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors w-fit"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Workspace
        </Link>
        <h2 className="font-bold uppercase tracking-tight">Developer</h2>
        <p className="text-xs text-muted-foreground mt-1">APIs, Webhooks & Tokens</p>
      </div>
      <nav className="p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`)
          return (
            <Link key={item.title} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
