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
  DatabaseIcon,
  Moon,
  Sun,
  LogOut,
  Building2,
  Menu,
  X,
  Settings,
  ImageIcon,
  Activity,
  Database,
  FileText,
  Puzzle,
  CreditCard,
  ClipboardList,
  Globe,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

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
      { title: "Tenants", href: "/admin/tenants", icon: Building2 },
      { title: "Billing & Revenue", href: "/admin/billing", icon: CreditCard },
    ],
  },
  {
    label: "GLOBAL CONTENT",
    items: [
      { title: "Content Builder", href: "/admin/content-types", icon: Database },
    ],
  },
  {
    label: "ADMINISTRATION",
    items: [
      { title: "Users & Roles", href: "/admin/users", icon: Users },
      { title: "RBAC Security", href: "/admin/rbac", icon: Shield },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { title: "Monitoring", href: "/admin/monitoring", icon: Activity },
      { title: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardList },
      { title: "Media Library", href: "/admin/media", icon: ImageIcon },
      { title: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
]

export function GlobalAdminSidebar() {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const isActive = (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="border-b border-border px-4 py-4">
        <Link href="/admin" className="flex items-center gap-3">
          <Logo iconSize="md" showText={true} />
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {adminNavSections.map((section) => (
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
                          "flex items-center gap-3 px-2 py-2 text-sm transition-colors rounded-none",
                          active
                            ? "bg-muted text-foreground font-semibold border-l-2 border-orange-500"
                            : "text-muted-foreground hover:text-foreground hover:bg-background border-l-2 border-transparent"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-orange-500")} />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5 rounded-none">{item.badge}</Badge>
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
          <Link href="/dashboard/profile" className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-muted/50 flex items-center justify-center text-foreground text-xs font-bold shrink-0 rounded-none">
              {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{session?.user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">Super Admin</p>
            </div>
          </Link>
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
