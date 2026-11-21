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
  Settings,
  Activity,
  Database,
  CreditCard,
  ClipboardList,
  Globe,
  Gem,
  Webhook,
  Headphones,
  Tag,
  Handshake,
  Rocket,
  Layout,
  Server,
  LayoutTemplate,
  Boxes,
  ChevronDown,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"
import { ProfileModal } from "@/components/dashboard/profile-modal"
import { MobilePortalMenu } from "@/components/dashboard/mobile-portal-menu"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  badge?: string
  exact?: boolean
  /** API behind this page is super_admin-only with no allowRoles override —
   *  hide it from a plain admin instead of linking to a page that 403s/hangs. */
  superAdminOnly?: boolean
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
      { title: "Pricing & Plans", href: "/admin/pricing", icon: Tag },
    ],
  },
  {
    label: "KONTEN",
    items: [
      { title: "CMS Frontend", href: "/admin/cms", icon: Layout, superAdminOnly: true },
    ],
  },
  {
    label: "DEVELOPER",
    items: [
      { title: "MCP Server", href: "/admin/developer/mcp", icon: Server, superAdminOnly: true },
      { title: "Website Template", href: "/admin/developer/templates", icon: LayoutTemplate, superAdminOnly: true },
      { title: "Global Component", href: "/admin/developer/schema", icon: Boxes, superAdminOnly: true },
    ],
  },
  {
    label: "PENJUALAN",
    items: [
      { title: "Penawaran", href: "/admin/proposals", icon: Handshake },
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
      { title: "Monitoring", href: "/admin/monitoring", icon: Activity, superAdminOnly: true },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardList, superAdminOnly: true },
      { title: "Project Vercel", href: "/admin/vercel-projects", icon: Rocket, superAdminOnly: true },
      { title: "Platform Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  {
    label: "ENTERPRISE",
    items: [
      { title: "Enterprise Licenses", href: "/admin/enterprise/licenses", icon: Gem },
    ],
  },
]

/** Platform role → the label shown under the profile name in this sidebar's
 *  footer. Kept in sync with getRoleBadge() in admin/users/page.tsx. */
function roleLabel(role: string | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super Admin"
    case "employee":
    case "karyawan":
      return "Staf Internal"
    case "finance":
      return "Bendahara"
    default:
      return "Admin"
  }
}

export function GlobalAdminSidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [unreadSupportCount, setUnreadSupportCount] = useState(0)
  // Collapsible nav groups — keyed by section label, explicit true/false
  // once the admin has toggled it. A section with no explicit entry here
  // defaults to open only when it contains the current route, so the
  // sidebar starts decluttered instead of every group wide open.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const userId = session?.user?.id

  useEffect(() => {
    try {
      const saved = localStorage.getItem("admin-sidebar-open-sections")
      if (saved) setOpenSections(JSON.parse(saved))
    } catch {}
  }, [])

  const toggleSection = (label: string, currentlyOpen: boolean) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: !currentlyOpen }
      try { localStorage.setItem("admin-sidebar-open-sections", JSON.stringify(next)) } catch {}
      return next
    })
  }
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

    if (!role || role === "super_admin") return sectionsWithBadges

    // Staf Internal ("employee") and Bendahara ("finance") are narrow
    // /admin/* roles — allow-list their exact pages rather than relying on
    // the generic superAdminOnly flag (which only hides the super-admin-
    // exclusive pages, not the ones scoped to the OTHER narrow role).
    // Mirrors the real API gates in each route's `allowRoles`.
    const NARROW_ROLE_PATHS: Record<string, string[]> = {
      employee: ["/admin/support", "/admin/pricing", "/admin/proposals"],
      finance: ["/admin/billing", "/admin/pricing"],
    }
    const allowedPaths = NARROW_ROLE_PATHS[role]
    if (!allowedPaths) return [] // Unrecognized/retired role — nothing to show

    return sectionsWithBadges
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => allowedPaths.includes(item.href)),
      }))
      .filter((section) => section.items.length > 0)
  }

  const filteredNavSections = getFilteredNav()

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="border-b border-border px-3.5 py-3 flex items-center justify-between gap-2 shrink-0">
        <Link href="/admin" className="flex items-center gap-2 min-w-0">
          <Logo iconSize="sm" showText={true} showDetail={true} customDetail="Smart CMS" />
        </Link>
        <Button variant="outline" size="sm" asChild className="h-7 px-2 text-[10px] font-bold text-muted-foreground hover:text-foreground rounded-lg border-border/70 shrink-0 shadow-none">
          <Link href="/dashboard" title="Kembali ke Workspace Hub">
            <LayoutDashboard className="h-3 w-3 mr-1 text-primary" />
            Workspace
          </Link>
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {filteredNavSections.map((section) => {
            const hasActiveItem = section.items.some(isActive)
            const sectionOpen = section.label in openSections ? openSections[section.label] : hasActiveItem
            return (
              <div key={section.label} className="pb-1">
                <button
                  type="button"
                  onClick={() => toggleSection(section.label, sectionOpen)}
                  className="w-full flex items-center justify-between gap-2 px-2 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground transition-colors rounded-lg"
                >
                  <span>{section.label}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", sectionOpen && "rotate-180")} />
                </button>
                {sectionOpen && (
                  <div className="space-y-1 mt-1">
                    {section.items.map((item) => {
                      const active = isActive(item)
                      return (
                        <Link
                          key={item.title + item.href}
                          href={item.href}
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
                )}
              </div>
            )
          })}
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
              <p className="text-xs text-muted-foreground truncate">{roleLabel(session?.user?.role)}</p>
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
      <MobilePortalMenu portal="Admin" className="fixed left-3 top-3 z-40 bg-card/90 shadow-xs backdrop-blur">
        {renderSidebarContent()}
      </MobilePortalMenu>

      <aside className="hidden md:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </>
  )
}
