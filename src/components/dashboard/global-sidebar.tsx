"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  LayoutDashboard,
  CreditCard,
  Layers,
  LayoutTemplate,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Shield,
  Sparkles,
  BookOpen,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { signOut } from "next-auth/react"
import { Logo } from "@/components/ui/logo"
import { ProfileModal } from "@/components/dashboard/profile-modal"

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

interface GlobalSidebarProps {
  isEnterpriseMode?: boolean
  session?: any
  brandName?: string
}

export function GlobalSidebar({ isEnterpriseMode, session, brandName }: GlobalSidebarProps = {}) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const navItems: NavItem[] = [
    { title: "Workspaces", href: "/dashboard", icon: LayoutDashboard },
    { title: "Billing & Account", href: "/dashboard/billing", icon: CreditCard },
    { title: "API & Dokumentasi", href: "/docs", icon: BookOpen },
  ]

  // Add SaaS admin panel for super_admin
  if (session?.user?.role === "super_admin") {
    navItems.push({
      title: "Super Admin Panel",
      href: "/admin",
      icon: Shield,
    })
  }

  const isActive = (item: NavItem) => {
    if (item.href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname?.startsWith(item.href)
  }

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 shrink-0 items-center border-b px-6">
        <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
          <Logo iconSize="md" showText={true} useOrange={true} customName={brandName} />
        </Link>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.title + item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all duration-200 group",
                    active
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                  <span className="truncate">{item.title}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      <div className="border-t p-3 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/40 border border-border/60">
          <button 
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition-opacity text-left cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-xs font-black shadow-xs shrink-0">
              {session?.user?.image ? (
                <img src={session.user.image} alt={session.user.name || "Avatar"} className="w-full h-full object-cover" />
              ) : (
                session?.user?.name?.[0]?.toUpperCase() ?? "U"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate text-foreground leading-none mb-1">{session?.user?.name || "User Profile"}</p>
              <p className="text-[10px] text-muted-foreground truncate">{session?.user?.email}</p>
            </div>
          </button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg shrink-0 hover:bg-muted" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
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
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-8 text-xs font-semibold transition-all"
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
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 md:hidden h-10 w-10 bg-card/90 backdrop-blur border border-border shadow-xs rounded-xl"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 border-r transition-transform duration-300 md:hidden shadow-none", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        {renderSidebarContent()}
      </aside>

      <aside className="hidden md:block w-64 border-r shrink-0 h-screen sticky top-0 bg-card">
        {renderSidebarContent()}
      </aside>

      <ProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </>
  )
}
