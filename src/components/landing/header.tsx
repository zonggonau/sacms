"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Database, Menu, X } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

const NAV_ITEMS = [
  { label: "Fitur", href: "/#features" },
  { label: "Harga", href: "/#pricing" },
  { label: "Layanan", href: "/#sektor" },
  { label: "Dokumentasi", href: "/docs" },
]

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500 ${
      scrolled 
        ? "py-3 bg-background/60 backdrop-blur-xl border-b border-border/50 shadow-sm" 
        : "py-6 bg-transparent"
    }`}>
      <div className="container px-6 max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">SaCMS</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-card/30 backdrop-blur-md px-2 py-1.5 rounded-full border border-border/50 shadow-sm shadow-black/5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target={item.href === "/docs" ? "_blank" : undefined}
              rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
              className="text-sm font-semibold text-muted-foreground hover:text-primary hover:bg-primary/10 px-4 py-2 rounded-full transition-all duration-300"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="rounded-full text-foreground hover:text-primary hover:bg-primary/10 font-bold px-6">
                Masuk
              </Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-full bg-primary hover:bg-primary/90 text-white font-bold px-7 shadow-lg shadow-primary/20 hover:scale-105 transition-all duration-300">
                Mulai Gratis
              </Button>
            </Link>
          </div>
          
          <Button variant="ghost" size="icon" className="md:hidden rounded-full text-foreground hover:bg-primary/10" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/50 bg-background/80 backdrop-blur-2xl overflow-hidden shadow-2xl"
          >
            <nav className="container px-6 py-6 flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href} 
                  target={item.href === "/docs" ? "_blank" : undefined}
                  rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
                  className="text-base font-bold text-muted-foreground hover:text-primary p-3 rounded-xl hover:bg-primary/5 transition-colors" 
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-6 pb-2 mt-2 border-t border-border/50">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full rounded-full border-border/50 font-bold h-12">
                    Masuk
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-full bg-primary hover:bg-primary/90 text-white font-bold h-12 shadow-lg shadow-primary/20">
                    Mulai Gratis Sekarang
                  </Button>
                </Link>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
