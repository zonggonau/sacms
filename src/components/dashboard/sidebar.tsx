"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  LayoutDashboard,
  Database,
  FileText,
  Layers,
  Users,
  CreditCard,
  Settings,
  Activity,
  Key,
  ChevronDown,
  DatabaseIcon,
  Moon,
  Sun,
  LogOut,
  Building2,
  Menu,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

interface SidebarProps {
  isSuperAdmin: boolean
  tenantSlug?: string
  tenants?: Array<{ id: string; slug: string; name: string; role: string }>
}

const superAdminNavItems = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "Tenants", href: "/dashboard/tenants", icon: Building2 },
  {
    title: "Content Types",
    href: "/dashboard/content-types",
    icon: Database,
    children: [
      { title: "All Content Types", href: "/dashboard/content-types" },
      { title: "Create New", href: "/dashboard/content-types/new" },
    ],
  },
  { title: "Single Types", href: "/dashboard/single-types", icon: FileText },
  { title: "Components", href: "/dashboard/components", icon: Layers },
  { title: "Billing", href: "/dashboard/billing", icon: CreditCard },
  { title: "Subscriptions", href: "/dashboard/subscriptions", icon: CreditCard },
  { title: "Users", href: "/dashboard/users", icon: Users },
  { title: "API Keys", href: "/dashboard/api-keys", icon: Key },
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
  { title: "Monitoring", href: "/dashboard/monitoring", icon: Activity },
]

const tenantAdminNavItems = [
  { title: "Dashboard", href: "", icon: LayoutDashboard },
  {
    title: "Content Types",
    href: "/content-types",
    icon: Database,
    children: [
      { title: "All Content Types", href: "/content-types" },
      { title: "Create New", href: "/content-types/new" },
    ],
  },
  { title: "Single Types", href: "/single-types", icon: FileText },
  { title: "Components", href: "/components", icon: Layers },
  { title: "Subscriptions", href: "/subscriptions", icon: CreditCard },
  { title: "Users", href: "/users", icon: Users },
  { title: "API Keys", href: "/api-keys", icon: Key },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function DashboardSidebar({ isSuperAdmin, tenantSlug, tenants = [] }: SidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openItems, setOpenItems] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems = isSuperAdmin ? superAdminNavItems : tenantAdminNavItems

  const getHref = (href: string) => {
    if (isSuperAdmin) {
      return href
    }
    return `/dashboard/${tenantSlug}${href}`
  }

  const toggleItem = (title: string) => {
    setOpenItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    )
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <DatabaseIcon className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold">ContentFlow</span>
        </Link>
      </div>

      {/* Tenant Switcher */}
      {!isSuperAdmin && tenants && tenants.length > 1 && (
        <div className="border-b p-4">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Switch Workspace
          </label>
          <div className="space-y-1">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/${t.slug}`}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  t.slug === tenantSlug
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                <Building2 className="h-4 w-4" />
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === getHref(item.href)
            const hasChildren = item.children && item.children.length > 0
            const isOpen = openItems.includes(item.title)

            if (hasChildren) {
              return (
                <Collapsible
                  key={item.title}
                  open={isOpen}
                  onOpenChange={() => toggleItem(item.title)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-2",
                        isActive && "bg-muted"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.title}
                      <ChevronDown
                        className={cn(
                          "ml-auto h-4 w-4 transition-transform",
                          isOpen && "rotate-180"
                        )}
                      />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                    {item.children!.map((child) => (
                      <Link
                        key={child.href}
                        href={getHref(child.href)}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm transition-colors",
                          pathname === getHref(child.href)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        )}
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.title}
                      </Link>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )
            }

            return (
              <Link key={item.title} href={getHref(item.href)} onClick={() => setMobileOpen(false)}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-2",
                    isActive && "bg-muted font-medium"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.title}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {session?.user?.email}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted ? (
              theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
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
      {/* Mobile Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {renderSidebarContent()}
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r bg-card">
        {renderSidebarContent()}
      </aside>
    </>
  )
}
