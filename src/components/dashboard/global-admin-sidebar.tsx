"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
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
    label: "BUILDER (GLOBAL)",
    items: [
      { title: "Content Types", href: "/admin/content-types", icon: Database },
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
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <Link href="/admin" className="flex items-center gap-2.5">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <DatabaseIcon className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold">SaCMS</span>
            <span className="text-[11px] text-muted-foreground">Platform Admin</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="px-2 space-y-4">
          {adminNavSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-[10px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
                {section.label}
              </p>
              <div className="space-y-0.5">
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
                          "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-emerald-600 dark:text-emerald-400")} />
                        <span className="truncate">{item.title}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">{item.badge}</Badge>
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
      <div className="border-t p-2 space-y-1">
        <div className="flex items-center gap-2 px-2 py-2 rounded-md">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{session?.user?.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">Super Admin</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? (
              theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />
            ) : (
              <div className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 text-xs"
          onClick={handleSignOut}
        >
          <LogOut className="h-3 w-3" />
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
        className="fixed top-3 left-3 z-50 md:hidden h-9 w-9 bg-background/80 backdrop-blur border shadow-sm"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 w-60 border-r transition-transform duration-200 md:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden md:block w-60 border-r shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>
    </>
  )
}
