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
  tenantSlug: string
}

export function CMSSidebar({ tenantSlug }: CMSSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [assignedContentTypes, setAssignedContentTypes] = useState<any[]>([])

  const href = (path: string) => `/cms/${tenantSlug}${path}`

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch only content types for this tenant
  useEffect(() => {
    async function fetchContentTypes() {
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/content-types`)
        if (res.ok) {
          const data = await res.json()
          // API returns an array directly, not data.contentTypes
          setAssignedContentTypes(Array.isArray(data) ? data : (data.contentTypes || []))
        }
      } catch (error) {
        console.error("Failed to fetch content types:", error)
      }
    }
    if (tenantSlug) fetchContentTypes()
  }, [tenantSlug])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r shadow-xl">
      {/* CMS Header */}
      <div className="border-b px-6 py-6 bg-emerald-600 dark:bg-emerald-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
            <PenTool className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-lg font-black tracking-tight leading-none">CMS Portal</span>
            <span className="text-[10px] opacity-70 font-bold uppercase tracking-widest mt-1">Content Studio</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 py-6">
        <div className="px-4 space-y-8">
          {/* General */}
          <div className="space-y-1">
            <p className="px-4 mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">General</p>
            <Link href={href("")}>
              <div className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                pathname === href("") ? "bg-emerald-500/10 text-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}>
                <LayoutDashboard className="h-4.5 w-4.5" /> Dashboard
              </div>
            </Link>
            <Link href={href("/media")}>
              <div className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                pathname.startsWith(href("/media")) ? "bg-emerald-500/10 text-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}>
                <ImageIcon className="h-4.5 w-4.5" /> Media Library
              </div>
            </Link>
          </div>

          {/* Collections */}
          <div className="space-y-1">
            <p className="px-4 mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">Collections</p>
            {assignedContentTypes.length === 0 ? (
              <p className="px-4 text-[10px] text-muted-foreground italic">No collections assigned</p>
            ) : (
              assignedContentTypes.map(ct => (
                <Link key={ct.id} href={href(`/content/${ct.slug}`)}>
                  <div className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all group",
                    pathname.startsWith(href(`/content/${ct.slug}`)) ? "bg-emerald-500/10 text-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-muted"
                  )}>
                    <Database className="h-4 w-4 opacity-50 group-hover:opacity-100" />
                    <span className="truncate">{ct.name}</span>
                    <ChevronRight className="ml-auto h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Single Pages */}
          <div className="space-y-1">
            <p className="px-4 mb-2 text-[10px] font-black tracking-widest text-muted-foreground uppercase opacity-50">Static Pages</p>
            <Link href={href("/single-types")}>
              <div className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                pathname.startsWith(href("/single-types")) ? "bg-emerald-500/10 text-emerald-600 shadow-sm" : "text-muted-foreground hover:bg-muted"
              )}>
                <Layers className="h-4.5 w-4.5" /> Manage Singles
              </div>
            </Link>
          </div>
        </div>
      </ScrollArea>

      {/* Footer User Info */}
      <div className="border-t p-4 space-y-3 bg-muted/20">
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black border-2 border-white shadow-sm">
            {session?.user?.name?.[0]?.toUpperCase() ?? "E"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black truncate leading-none mb-1">{session?.user?.name}</p>
            <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-black bg-white/50 border-emerald-200 text-emerald-700">EDITOR</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
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
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-red-50 rounded-xl h-9 text-xs font-bold"
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
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-emerald-600 text-white shadow-lg rounded-xl"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r transition-transform duration-300 md:hidden shadow-2xl", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden md:block w-64 border-r shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>
    </>
  )
}
