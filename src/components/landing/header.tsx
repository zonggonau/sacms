"use client"

import { useState, useEffect } from "react"
import { Menu, X, LayoutDashboard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Logo } from "@/components/ui/logo"
import { useSession } from "next-auth/react"
import { cn } from "@/lib/utils"

export function LandingHeader({ brandName }: { brandName?: string }) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const navItems = [
    { label: "Beranda", href: "/" },
    { label: "Fitur", href: "/fitur" },
    { label: "Harga", href: "/harga" },
    { label: "Tentang", href: "/tentang" },
    { label: "Blog", href: "/blog" },
    { label: "Docs", href: "/docs" },
  ]

  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/"
    return pathname?.startsWith(href)
  }

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const isUserBiasa = session?.user?.role === "user"
  const defaultTenantSlug = session?.user?.tenants?.[0]?.slug || session?.user?.tenants?.[0]?.id
  const dashboardUrl = isUserBiasa ? "/aibuilder" : (defaultTenantSlug ? `/dashboard/${defaultTenantSlug}` : "/dashboard")
  const actionLabel = isUserBiasa ? "Buka AI Builder" : "Buka Dashboard"
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "User"
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ${
      scrolled
        ? "py-3 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm"
        : "py-6 bg-transparent"
    }`}>
      <div className="container px-4 sm:px-6 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-3 group">
            <Logo iconSize="md" showText={true} showDetail={true} useOrange={true} customName={brandName} />
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-card/60 backdrop-blur-md px-2 py-1.5 rounded-full border border-border/60 shadow-xs">
          {navItems.map((item) => {
            const active = isItemActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                target={item.href === "/docs" ? "_blank" : undefined}
                rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
                className={cn(
                  "text-xs font-semibold px-3.5 py-1.5 rounded-full transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            {status === "authenticated" && session?.user ? (
              <>
                <Link
                  href={dashboardUrl}
                  className="flex items-center gap-2 text-xs font-bold text-foreground hover:text-primary transition-colors py-1.5 px-3 rounded-full hover:bg-muted/40 border border-border/50 bg-background/50 backdrop-blur-sm"
                >
                  <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-[10px]">
                    {userInitial}
                  </div>
                  <span className="truncate max-w-[120px]">{userName}</span>
                </Link>
                <Link href={dashboardUrl}>
                  <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 shadow-sm hover:scale-[1.02] transition-all gap-1.5 text-xs h-8">
                    {isUserBiasa ? <Sparkles className="w-3.5 h-3.5" /> : <LayoutDashboard className="w-3.5 h-3.5" />}
                    {actionLabel}
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="rounded-full text-foreground hover:text-primary hover:bg-primary/10 font-bold px-4 text-xs h-8">
                    Masuk
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 shadow-sm hover:scale-[1.02] transition-all text-xs h-8">
                    Mulai Gratis
                  </Button>
                </Link>
              </>
            )}
          </div>

          <Button variant="ghost" size="icon" className="md:hidden rounded-full text-foreground hover:bg-primary/10 h-9 w-9" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-2xl overflow-hidden shadow-2xl"
          >
            <nav className="container px-6 py-5 flex flex-col gap-2">
              {navItems.map((item) => {
                const active = isItemActive(item.href)
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.href === "/docs" ? "_blank" : undefined}
                    rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
                    className={cn(
                      "text-sm font-bold p-2.5 rounded-xl transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-black"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    )}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {item.label}
                  </Link>
                )
              })}

              {status === "authenticated" && session?.user ? (
                <div className="flex flex-col gap-2.5 pt-4 pb-2 mt-1 border-t border-border/50">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30 border border-border/60">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {userInitial}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-bold text-foreground truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                    </div>
                  </div>
                  <Link href={dashboardUrl} onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 shadow-sm gap-2 text-xs">
                      {isUserBiasa ? <Sparkles className="w-4 h-4" /> : <LayoutDashboard className="w-4 h-4" />}
                      {actionLabel}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5 pt-4 pb-2 mt-1 border-t border-border/50">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full rounded-2xl border-border/60 font-bold h-11 text-xs">
                      Masuk
                    </Button>
                  </Link>
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-11 shadow-sm text-xs">
                      Mulai Gratis
                    </Button>
                  </Link>
                </div>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
