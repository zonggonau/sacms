"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DatabaseIcon,
  FileText,
  Puzzle,
  Bot,
  Sparkles,
  Layers
} from "lucide-react"
import { NestedSidebarHeader } from "@/components/dashboard/nested-sidebar-header"

interface ContentBuilderSidebarProps {
  tenantId: string
}

export function ContentBuilderSidebar({ tenantId }: ContentBuilderSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { title: "AI Website Builder", href: `/dashboard/${tenantId}/content-type-builder/overview`, icon: Bot, badge: "AI" },
    { title: "Collection Types", href: `/dashboard/${tenantId}/content-type-builder/content-types`, icon: DatabaseIcon },
    { title: "Single Types", href: `/dashboard/${tenantId}/content-type-builder/single-types`, icon: FileText },
    { title: "Components", href: `/dashboard/${tenantId}/content-type-builder/components`, icon: Puzzle },
  ]

  return (
    <div className="w-64 border-r border-border/80 bg-card h-full flex flex-col shrink-0">
      <NestedSidebarHeader tenantId={tenantId} logoHref={`/dashboard/${tenantId}/content-type-builder/content-types`} portalBadge="Builder" />
      <div className="p-3 space-y-1">
        <p className="px-3 mb-2 text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">
          Skema & Arsitektur
        </p>
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href)
          
          return (
            <Link key={item.title} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all group",
                  isActive
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="truncate flex-1">{item.title}</span>
                {item.badge && (
                  <span className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full font-bold",
                    isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  )}>
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

