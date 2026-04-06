"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  ImageIcon,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Webhook,
  Key,
  Layers,
  CreditCard,
  Languages,
  ChevronDown,
  Play,
  BookOpen,
  ClipboardList,
  Sparkles,
  ChevronRight,
  Database,
  DatabaseIcon,
  Puzzle
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

interface TenantSidebarProps {
  tenantId?: string
  tenantSlug?: string
  tenants?: Array<{ id: string; slug: string; name: string; role: string }>
}

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
  indent?: boolean
  matchPrefix?: boolean
  target?: string
}

interface NavSection {
  label: string
  items: NavItem[]
}

export function TenantSidebar({ tenantId: propId, tenantSlug, tenants }: TenantSidebarProps) {
  const tenantId = propId || tenantSlug
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [workspaceSwitcherOpen, setWorkspaceSwitcherOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  const [liveTenants, setLiveTenants] = useState<any[]>([])
  const [assignedContentTypes, setAssignedContentTypes] = useState<any[]>([])

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentTenant = liveTenants.length > 0 
    ? liveTenants.find((t) => t.id === tenantId) 
    : (session?.user?.tenants || []).find((t: any) => t.id === tenantId)

  const href = (path: string) => {
    if (path === "/cms-redirect") return `/cms/${tenantId}`
    return `/dashboard/${tenantId}${path}`
  }

  const isActive = (item: NavItem) => {
    const fullPath = href(item.href)
    if (item.matchPrefix) return pathname?.startsWith(fullPath)
    return pathname === fullPath
  }

  // Fetch live list of user's tenants
  useEffect(() => {
    async function fetchTenants() {
      try {
        const res = await fetch("/api/tenants")
        if (res.ok) {
          const data = await res.json()
          setLiveTenants(data.tenants || [])
        }
      } catch (error) {
        console.error("Failed to fetch tenants:", error)
      }
    }
    if (session?.user) fetchTenants()
  }, [session])

  // Fetch assigned content types for this tenant
  useEffect(() => {
    async function fetchContentTypes() {
      if (!tenantId) return
      try {
        const res = await fetch(`/api/tenant/${tenantId}/content-types`)
        if (res.ok) {
          const data = await res.json()
          setAssignedContentTypes(data.contentTypes || [])
        }
      } catch (error) {
        console.error("Failed to fetch tenant content types:", error)
      }
    }
    fetchContentTypes()
  }, [tenantId])

  const navSections: NavSection[] = [
    {
      label: "CONTENT",
      items: [
        { title: "Content Studio", href: "/cms-redirect", icon: Sparkles, badge: "STUDIO", target: "_blank" },
        { title: "Overview", href: "", icon: LayoutDashboard },
        { title: "Content Types", href: "/content-types", icon: DatabaseIcon, matchPrefix: true },
        { title: "Single Types", href: "/single-types", icon: Layers, matchPrefix: true },
        { title: "Components", href: "/components", icon: Puzzle, matchPrefix: true },
        // Dynamic collection entries
        ...assignedContentTypes.map(ct => ({
          title: ct.name,
          href: `/content/${ct.slug}`,
          icon: Database,
          matchPrefix: true
        })),
        { title: "Media Library", href: "/media", icon: ImageIcon },
      ],
    },
    {
      label: "MANAGEMENT",
      items: [
        { title: "Team Members", href: "/users", icon: Users },
        { title: "Localization", href: "/localization", icon: Languages },
        { title: "Billing & Plans", href: "/subscriptions", icon: CreditCard, matchPrefix: true },
      ],
    },
    {
      label: "DEVELOPER",
      items: [
        { title: "API Tokens", href: "/api-keys", icon: Key },
        { title: "Webhooks", href: "/webhooks", icon: Webhook },
        { title: "API Explorer", href: "/developer/api", icon: Play },
        { title: "SDK & Docs", href: "/developer/sdk", icon: BookOpen },
      ],
    },
    {
      label: "SETTINGS",
      items: [
        { title: "Audit Trail", href: "/system/audit", icon: ClipboardList },
        { title: "Workspace Settings", href: "/settings", icon: Settings, matchPrefix: true },
      ],
    },
  ]

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card">
      {/* Workspace Header */}
      <div className="border-b">
        <button
          onClick={() => setWorkspaceSwitcherOpen(!workspaceSwitcherOpen)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 cursor-pointer"
        >
          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {(currentTenant?.name || "W")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold truncate">{currentTenant?.name || "Workspace"}</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 capitalize shrink-0 font-bold border-primary/20 text-primary">
                {currentTenant?.role || "member"}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">/{tenantId}</span>
          </div>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", workspaceSwitcherOpen && "rotate-180")} />
        </button>

        {/* Workspace Switcher */}
        {workspaceSwitcherOpen && (
          <div className="border-t px-2 py-2 space-y-0.5 max-h-64 overflow-y-auto bg-muted/20">
            {liveTenants.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/${t.id}`}
                onClick={() => { setMobileOpen(false); setWorkspaceSwitcherOpen(false) }}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs transition-colors",
                  t.id === tenantId
                    ? "bg-primary/10 text-primary font-bold"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] font-bold shrink-0">
                  {t.name[0].toUpperCase()}
                </div>
                <span className="truncate">{t.name}</span>
                {t.id === tenantId && <ChevronRight className="ml-auto h-3 w-3 text-primary" />}
              </Link>
            ))}
            
            <div className="pt-2 mt-2 border-t">
              <Link
                href="/dashboard"
                onClick={() => { setMobileOpen(false); setWorkspaceSwitcherOpen(false) }}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-xs text-primary font-bold hover:bg-primary/5 transition-colors"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                <span>Change Workspace</span>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-2 text-[10px] font-black tracking-widest text-muted-foreground/50 uppercase">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item)
                  return (
                    <Link
                      key={item.title + item.href}
                      href={href(item.href)}
                      onClick={() => setMobileOpen(false)}
                      target={item.target}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 group",
                          active
                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 font-bold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-110", active ? "text-primary-foreground" : "text-muted-foreground")} />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700">{item.badge}</Badge>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {session?.user?.name?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate leading-none mb-1">{session?.user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 hover:bg-muted" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? (
              theme === "dark" ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-indigo-500" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-xl h-9 text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 text-red-500" />
          <span className="font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-background/80 backdrop-blur border shadow-md rounded-xl"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r transition-transform duration-300 md:hidden shadow-2xl", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden md:block w-64 border-r shrink-0 sticky top-0 h-screen bg-card">
        {renderSidebarContent()}
      </aside>
    </>
  )
}
