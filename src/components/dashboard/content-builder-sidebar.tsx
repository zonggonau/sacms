"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  DatabaseIcon,
  FileText,
  Puzzle,
  ArrowLeft,
} from "lucide-react"
import { NestedSidebarHeader } from "@/components/dashboard/nested-sidebar-header"

interface ContentBuilderSidebarProps {
  tenantId: string
}

export function ContentBuilderSidebar({ tenantId }: ContentBuilderSidebarProps) {
  const pathname = usePathname()

  const navItems = [
    { title: "Collection Types", href: `/dashboard/${tenantId}/content-type-builder/content-types`, icon: DatabaseIcon },
    { title: "Single Types", href: `/dashboard/${tenantId}/content-type-builder/single-types`, icon: FileText },
    { title: "Components", href: `/dashboard/${tenantId}/content-type-builder/components`, icon: Puzzle },
  ]

  return (
    <div className="w-64 border-r bg-muted/10 h-full flex flex-col">
      <NestedSidebarHeader tenantId={tenantId} logoHref={`/dashboard/${tenantId}/content-type-builder/content-types`} />
      <div className="p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname?.startsWith(item.href)
          
          return (
            <Link key={item.title} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.title}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
