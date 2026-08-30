"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/ui/logo"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  Users,
  Shield,
  Moon,
  Sun,
  LogOut,
  Building2,
  Menu,
  X,
  Settings,
  Activity,
  Database,
  CreditCard,
  ClipboardList,
  Globe,
  Gem,
  Webhook,
  Server,
  Headphones,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import { ProfileModal } from "@/components/dashboard/profile-modal"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
  exact?: boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const adminNavSections: NavSection[] = [
  {
    label: "OPERATIONS",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
      { title: "Support & Chat CS", href: "/admin/support", icon: Headphones },
      { title: "Tenants / Workspace", href: "/admin/tenants", icon: Building2 },
      { title: "Billing & Revenue", href: "/admin/billing", icon: CreditCard },
    ],
  },
  {
    label: "IDENTITY & ACCESS",
    items: [
      { title: "Users & Access", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "INFRASTRUCTURE",
    items: [
      { title: "Custom Domains", href: "/admin/domains", icon: Globe },
      { title: "Webhooks & DLQ", href: "/admin/webhooks", icon: Webhook },
      { title: "Databases & Routing", href: "/admin/databases", icon: Database },
    ],
  },
  {
    label: "SYSTEM & AUDIT",
    items: [
      { title: "Monitoring", href: "/admin/monitoring", icon: Activity },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardList },
      { title: "Platform Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    label: "ENTERPRISE",
    items: [
      { title: "Dedicated VPS Infra", href: "/admin/infrastructure", icon: Server },
      { title: "Enterprise Licenses", href: "/admin/enterprise/licenses", icon: Gem },
    ],
  },
]

export function GlobalAdminSidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [permittedPaths, setPermittedPaths] = useState<string[] | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [unreadSupportCount, setUnreadSupportCount] = useState(0)

  const userId = session?.user?.id
  useEffect(() => {
    setMounted(true)

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/support/unread-count")
        if (res.ok) {
          const data = await res.json()
          setUnreadSupportCount(data.unreadCount || 0)
        }
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 8000)

    // Fetch dynamic permissions
    const fetchPerms = async () => {
      if (userId) {
        try {
          const res = await fetch('/api/user/permissions')
          if (res.ok) {
            const data = await res.json()
            setPermittedPaths(data.permissions)
          } else {
            setPermittedPaths([])
          }
        } catch (e) {
          setPermittedPaths([])
        }
      }
    }
    fetchPerms()

    return () => clearInterval(interval)
  }, [userId])

  // Hide the global admin sidebar when inside a specific schema builder template editor 
  // (but show it on the general /admin/schema-builder listing)
  const isTemplateEditor = pathname.startsWith('/admin/schema-builder/')
  if (isTemplateEditor) {
    return null
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const getFilteredNav = () => {
    const role = session?.user?.role
    const sectionsWithBadges = adminNavSections.map(sec => ({
      ...sec,
      items: sec.items.map(item => {
        if (item.href === "/admin/support" && unreadSupportCount > 0) {
          return { ...item, badge: `${unreadSupportCount} BARU` }
        }
        return item
      })
    }))

    if (!role || role === "super_admin" || role === "admin" || (permittedPaths && permittedPaths.includes("*"))) return sectionsWithBadges

    if (!permittedPaths) return [] // Loading state

    return sectionsWithBadges
      .map((section) => {
        const items = section.items.filter((item) => {
          // Check if the user has a permission name that matches the item.href or a wildcard that covers it
          return permittedPaths.some(p => item.href === p || item.href.startsWith(p + '/'))
        })
        return { ...section, items }
      })
      .filter((section) => section.items.length > 0)
  }

  const filteredNavSections = getFilteredNav()

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="border-b border-border px-4 py-3.5 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Logo iconSize="md" showText={true} />
        </Link>
        <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-lg border border-border/50">
          <Link href="/dashboard" title="Kembali ke Workspace Hub">
            <LayoutDashboard className="h-3 w-3 mr-1 text-primary" />
            Workspace
          </Link>
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {filteredNavSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item)
                  return (
                    <Link
                      key={item.title + item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 text-xs font-semibold transition-all rounded-xl",
                          active
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground")} />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <Badge variant={active ? "outline" : "orange"} className={cn("ml-auto text-[9px] h-4 px-1.5 rounded-full font-bold", active && "border-primary-foreground/30 text-primary-foreground")}>{item.badge}</Badge>
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
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center text-foreground text-xs font-bold shrink-0 border border-border">
              {session?.user?.image ? (
                <img src={session.user.image} alt={session.user.name || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                session?.user?.name?.[0]?.toUpperCase() ?? "A"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{session?.user?.name || "Admin Profile"}</p>
              <p className="text-xs text-muted-foreground truncate">Super Admin</p>
            </div>
          </button>
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
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )

  if (pathname.startsWith('/admin/cms') || pathname.startsWith('/admin/content') || pathname.startsWith('/admin/billing')) {
    return null
  }

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-card/90 backdrop-blur border border-border shadow-xs rounded-xl text-foreground"
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

      <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </>
  )
}
