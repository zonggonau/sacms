"use client"

import Link from "next/link"
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
  Clock,
  Code2,
  ArrowLeft,
  ArrowRight,
  Plus,
  Settings,
  Sparkles,
  Sliders
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/ui/logo"
import { NestedSidebarHeader } from "@/components/dashboard/nested-sidebar-header"
import { ProfileModal } from "@/components/dashboard/profile-modal"

interface CMSSidebarProps {
  tenantId: string
  contentTypes?: { id: string; name: string; slug: string }[]
  singleTypes?: { id: string; name: string; slug: string }[]
  user?: { name?: string | null; email?: string | null; image?: string | null }
  userRole?: string
}

export function CMSSidebar({ tenantId, contentTypes = [], singleTypes = [], user, userRole }: CMSSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const href = (path: string) => `/dashboard/${tenantId}/cms${path}`
  const canGoBack = userRole === "owner" || userRole === "admin" || userRole === "super_admin"

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border shadow-none">
      {/* CMS Header */}
      <NestedSidebarHeader tenantId={tenantId} logoHref={href("")} showBackBtn={canGoBack} portalBadge="Studio" />

      <ScrollArea className="flex-1 py-4">
        <div className="px-3 space-y-6">
          {/* General */}
          <div className="space-y-1">
            <p className="px-3 mb-1.5 text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">Menu Utama</p>
            <Link href={href("")}>
              <div className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-all rounded-xl",
                pathname === href("")
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
                <LayoutDashboard className={cn("h-4 w-4 shrink-0 transition-transform", pathname === href("") ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>Dashboard</span>
              </div>
            </Link>
            <Link href={href("/media")}>
              <div className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-all rounded-xl",
                pathname.startsWith(href("/media"))
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
                <ImageIcon className={cn("h-4 w-4 shrink-0 transition-transform", pathname.startsWith(href("/media")) ? "text-primary-foreground" : "text-muted-foreground")} />
                <span>Media Library</span>
              </div>
            </Link>
          </div>

          {/* Collections */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-1.5">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">Koleksi Konten</p>
              {canGoBack && (
                <Link 
                  href={`/dashboard/${tenantId}/content-type-builder/content-types/new`}
                  title="Tambah Skema Koleksi Baru"
                  className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            {contentTypes.length === 0 ? (
              <p className="px-3 text-xs text-muted-foreground/60 italic">Belum ada skema</p>
            ) : (
              contentTypes.map(ct => {
                const active = pathname.startsWith(href(`/content/${ct.slug}`))
                return (
                  <div key={ct.id} className="relative group">
                    <Link href={href(`/content/${ct.slug}`)}>
                      <div className={cn(
                        "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-all rounded-xl",
                        active
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}>
                        <Database className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                        <span className="truncate flex-1 pr-6">{ct.name}</span>
                        {!canGoBack && (
                          <ChevronRight className={cn("h-3 w-3 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                        )}
                      </div>
                    </Link>
                    {canGoBack && (
                      <Link
                        href={`/dashboard/${tenantId}/content-type-builder/content-types/edit/${ct.slug}`}
                        title={`Edit Skema ${ct.name}`}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100",
                          active
                            ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20"
                            : "text-muted-foreground hover:text-primary hover:bg-muted"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Single Pages */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-3 mb-1.5">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground/60 uppercase">Halaman Statis</p>
              {canGoBack && (
                <Link 
                  href={`/dashboard/${tenantId}/content-type-builder/single-types/new`}
                  title="Tambah Single Type Baru"
                  className="text-muted-foreground hover:text-primary transition-colors p-0.5 rounded"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
            
            <Link href={href("/single-types")}>
              <div className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-all rounded-xl group",
                pathname === href("/single-types")
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}>
                <Layers className={cn("h-4 w-4 shrink-0", pathname === href("/single-types") ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                <span className="truncate flex-1">Semua Halaman</span>
              </div>
            </Link>

            {singleTypes.length > 0 && singleTypes.map(st => {
              const active = pathname.startsWith(href(`/single-types/${st.slug}`))
              return (
                <div key={st.id} className="relative group ml-3">
                  <Link href={href(`/single-types/${st.slug}`)}>
                    <div className={cn(
                      "flex items-center gap-2.5 px-3 py-1.5 text-xs transition-all rounded-lg",
                      active
                        ? "bg-muted text-foreground font-bold"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}>
                      <FileText className={cn("h-3.5 w-3.5 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                      <span className="truncate flex-1 pr-6">{st.name}</span>
                    </div>
                  </Link>
                  {canGoBack && (
                    <Link
                      href={`/dashboard/${tenantId}/content-type-builder/single-types/${st.slug}/edit`}
                      title={`Edit Skema ${st.name}`}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary hover:bg-muted"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Settings className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>

        </div>
      </ScrollArea>

      {/* Direct Quick Jump to Content-Type Builder */}
      {canGoBack && (
        <div className="px-3 pt-2 pb-1 border-t border-border/80 bg-muted/20">
          <Link href={`/dashboard/${tenantId}/content-type-builder/content-types`}>
            <div className="flex items-center gap-2.5 rounded-xl p-2.5 text-xs font-bold transition-all bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 group shadow-xs">
              <Database className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:rotate-12 transition-transform" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Content-Type Builder</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform text-indigo-600 dark:text-indigo-400" />
                </div>
                <p className="text-[10px] text-muted-foreground font-normal truncate mt-0.5">Edit skema & arsitektur model</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Footer User Info */}
      <div className="border-t p-3 space-y-2 bg-card">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/60">
          <button 
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-black shrink-0 shadow-xs">
              {user?.image ? (
                <img src={user.image} alt={user.name || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase() ?? "E"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate leading-none mb-1">{user?.name || "User Profile"}</p>
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 rounded-full font-bold bg-primary/10 border-primary/20 text-primary uppercase">{userRole || "EDITOR"}</Badge>
            </div>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0 hover:bg-muted text-muted-foreground hover:text-foreground" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? (
              theme === "dark" ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-primary" />
            ) : (
              <div className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 text-xs font-semibold rounded-xl transition-all"
          onClick={handleSignOut}
        >
          <LogOut className="h-3.5 w-3.5 text-destructive" />
          <span>Keluar</span>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-card/80 backdrop-blur border-border rounded-xl shadow-xs text-foreground"
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

      <ProfileModal 
        open={isProfileOpen} 
        onOpenChange={setIsProfileOpen} 
        userRole={userRole}
      />
    </>
  )
}
