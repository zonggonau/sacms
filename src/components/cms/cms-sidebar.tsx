"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  Database,
  ImageIcon,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Layers,
  ChevronRight,
  PenTool,
  FileText,
  Clock
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

interface CMSSidebarProps {
  tenantId: string
}

export function CMSSidebar({ tenantId }: CMSSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [assignedContentTypes, setAssignedContentTypes] = useState<any[]>([])

  const href = (path: string) => `/cms/${tenantId}${path}`

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch only content types for this tenant
  useEffect(() => {
    async function fetchContentTypes() {
      try {
        const res = await fetch(`/api/tenant/${tenantId}/content-types`)
        if (res.ok) {
          const data = await res.json()
          // API returns an array directly, not data.contentTypes
          setAssignedContentTypes(Array.isArray(data) ? data : (data.contentTypes || []))
        }
      } catch (error) {
        console.error("Failed to fetch content types:", error)
      }
    }
    if (tenantId) fetchContentTypes()
  }, [tenantId])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border shadow-none">
      {/* CMS Header */}
      <div className="border-b border-border px-6 py-6 bg-card">
        <Link href={href("")} className="flex items-center gap-3">
          <div className="w-8 h-8 shrink-0 bg-orange-500 flex items-center justify-center rounded-none">
            <PenTool className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-foreground">SaCMS</span>
            <span className="text-xs text-muted-foreground">Content Studio</span>
          </div>
        </Link>
      </div>

      <ScrollArea className="flex-1 py-6">
        <div className="px-3 space-y-8">
          {/* General */}
          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">General</p>
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
            <Link href={href("/media")}>
              <div className={cn(
                "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none border-l-2",
                pathname.startsWith(href("/media"))
                  ? "bg-muted text-foreground font-semibold border-orange-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-background border-transparent"
              )}>
                <ImageIcon className={cn("h-4 w-4 shrink-0", pathname.startsWith(href("/media")) && "text-orange-500")} /> Media Library
              </div>
            </Link>
          </div>

          {/* Collections */}
          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">Collections</p>
            {assignedContentTypes.length === 0 ? (
              <p className="px-2 text-xs text-muted-foreground italic">No collections assigned</p>
            ) : (
              assignedContentTypes.map(ct => {
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

          {/* Single Pages */}
          <div className="space-y-1">
            <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase opacity-75">Static Pages</p>
            <Link href={href("/single-types")}>
              <div className={cn(
                "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none border-l-2",
                pathname.startsWith(href("/single-types"))
                  ? "bg-muted text-foreground font-semibold border-orange-500"
                  : "text-muted-foreground hover:text-foreground hover:bg-background border-transparent"
              )}>
                <Layers className={cn("h-4 w-4 shrink-0", pathname.startsWith(href("/single-types")) && "text-orange-500")} /> Manage Singles
              </div>
            </Link>
          </div>
        </div>
      </ScrollArea>

      {/* Footer User Info */}
      <div className="border-t border-border p-4 space-y-2 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-muted/50 flex items-center justify-center text-foreground text-xs font-bold shrink-0 rounded-none border border-border">
            {session?.user?.name?.[0]?.toUpperCase() ?? "E"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate leading-none mb-1">{session?.user?.name}</p>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-none font-bold bg-muted/30 border-border text-muted-foreground">EDITOR</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-none text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? (
              theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted h-8 text-sm rounded-none"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 text-red-500" />
          Sign Out
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-card border-border rounded-none text-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-zinc-900/50 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-200 md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden md:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>
    </>
  )
}
