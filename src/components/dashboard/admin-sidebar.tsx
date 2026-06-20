"use client"

import { useParams, usePathname } from "next/navigation"
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
  Shield,
  Settings,
  Key,
  ChevronDown,
  DatabaseIcon,
  Moon,
  Sun,
  LogOut,
  Building2,
  Menu,
  X,
  Image,
  FolderTree,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut, useSession } from "next-auth/react"

interface AdminSidebarProps {
  tenantSlug?: string
  tenants?: Array<{ id: string; slug: string; name: string }>
}

const superAdminNavItems = [
  { title: "Overview", href: "/admin", icon: LayoutDashboard },
  {
    title: "Content Types",
    href: "/content-types",
    icon: Database,
    children: [
      { title: "All Content Types", href: "/content-types" },
      { title: "Create New", href: "/content-types/new" },
    ],
  },
  {
    title: "Single Types",
    href: "/single-types",
    icon: FileText,
    children: [
      { title: "All Single Types", href: "/single-types" },
      { title: "Create New", href: "/single-types/new" },
    ],
  },
  {
    title: "Components",
    href: "/components",
    icon: Layers,
    children: [
      { title: "All Components", href: "/components" },
      { title: "Create New", href: "/components/new" },
    ],
  },
  { title: "Media Library", href: "/media", icon: Image },
  { title: "Users & Roles", href: "/users", icon: Users },
  { title: "RBAC", href: "/rbac", icon: Shield },
  { title: "API Tokens", href: "/api-tokens", icon: Key },
  { title: "Settings", href: "/settings", icon: Settings },
]

export function AdminSidebar({ tenantSlug, tenants = [] }: AdminSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openItems, setOpenItems] = useState<string[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const getHref = (href: string) => {
    if (href === "/admin") return href
    return `/admin/${tenantSlug}${href}`
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

  const currentTenant = tenants?.find((t) => t.slug === tenantSlug)

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="p-6">
        <Link href="/admin" className="flex items-center gap-2">
          <Logo iconSize="md" showText={true} />
        </Link>
      </div>

      {/* Tenant Switcher */}
      {tenants && tenants.length > 0 && (
        <div className="border-b p-4">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Select Tenant
          </label>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {tenants.map((t) => (
              <Link
                key={t.id}
                href={`/admin/${t.slug}`}
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

      {/* Current Tenant */}
      {currentTenant && (
        <div className="border-b p-4 bg-muted/50">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{currentTenant.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Managing schema and structure
          </p>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {superAdminNavItems.map((item) => {
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

      <div className="border-t p-4 space-y-2">
        <div className="flex items-center justify-between">
          <Link href="/dashboard/profile" className="text-sm text-muted-foreground hover:underline truncate mr-2">
            {session?.user?.email}
          </Link>
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
