"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  UserCheck,
  Building,
  Puzzle,
  LayoutTemplate,
  ArrowLeft,
  Code,
  Sparkles
} from "lucide-react"

const contentNavItems = [
  { title: "Overview", href: "/admin/content", icon: LayoutDashboard, exact: true },
  { title: "Akun Plan", href: "/admin/content/sacms-account-pricing", icon: UserCheck },
  { title: "Workspace Plan", href: "/admin/content/sacms-workspace-pricing", icon: Building },
  { title: "AI Plan", href: "/admin/content/sacms-ai-pricing", icon: Sparkles },
  { title: "Addons", href: "/admin/content/sacms-addons", icon: Puzzle },
  { title: "Posts", href: "/admin/content/posts", icon: FileText },
  { title: "Landing Page", href: "/admin/content/landingpage", icon: LayoutTemplate },
]

export function ContentSidebar() {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="w-64 border-r border-border bg-card/50 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-border space-y-4">
        <Link 
          href="/admin"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Content</h2>
          <p className="text-xs text-muted-foreground">Manage templates and global content</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {contentNavItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4", active && "text-primary")} />
                {item.title}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
