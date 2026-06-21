"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Database, FileText, ChevronRight, LayoutDashboard, ArrowLeft } from "lucide-react"
import { usePathname } from "next/navigation"

interface AdminCMSSidebarProps {
  contentTypes?: { id: string; name: string; slug: string }[]
  singleTypes?: { id: string; name: string; slug: string }[]
}

export function AdminCMSSidebar({ contentTypes = [], singleTypes = [] }: AdminCMSSidebarProps) {
  const pathname = usePathname()
  const href = (path: string) => `/admin/cms${path}`

  return (
    <div className="flex h-full flex-col bg-muted/30 border-r border-border shadow-none w-64 shrink-0">
      <div className="border-b border-border px-6 py-6">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-3 w-3" /> Back to Admin
        </Link>
        <h2 className="font-bold tracking-tight text-lg">Global CMS</h2>
        <p className="text-xs text-muted-foreground">Manage global data</p>
      </div>

      <ScrollArea className="flex-1 py-6">
        <div className="px-3 space-y-8">
          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">Overview</p>
            <Link href={href("")}>
              <div className={cn(
                "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none border-l-2",
                pathname === href("")
                  ? "bg-muted text-foreground font-semibold border-orange-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-background border-transparent"
              )}>
                <LayoutDashboard className={cn("h-4 w-4 shrink-0", pathname === href("") && "text-orange-500")} /> Dashboard
              </div>
            </Link>
          </div>

          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">Content Types</p>
            {contentTypes.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground italic">No global collections</p>
            ) : (
              contentTypes.map(ct => {
                const active = pathname.startsWith(href(`/content/${ct.slug}`))
                return (
                  <Link key={ct.id} href={href(`/content/${ct.slug}`)}>
                    <div className={cn(
                      "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none border-l-2 group",
                      active
                        ? "bg-muted text-foreground font-semibold border-orange-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-background border-transparent"
                    )}>
                      <Database className={cn("h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100", active && "text-orange-500")} />
                      <span className="truncate flex-1">{ct.name}</span>
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">Single Types</p>
            {singleTypes.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground italic">No global single types</p>
            ) : (
              singleTypes.map(st => {
                const active = pathname.startsWith(href(`/single-types/${st.slug}`))
                return (
                  <Link key={st.id} href={href(`/single-types/${st.slug}`)}>
                    <div className={cn(
                      "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none border-l-2 group",
                      active
                        ? "bg-muted text-foreground font-semibold border-orange-500"
                        : "text-muted-foreground hover:text-foreground hover:bg-background border-transparent"
                    )}>
                      <FileText className={cn("h-4 w-4 shrink-0 opacity-70 group-hover:opacity-100", active && "text-orange-500")} />
                      <span className="truncate flex-1">{st.name}</span>
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                )
              })
            )}
          </div>

        </div>
      </ScrollArea>
    </div>
  )
}
