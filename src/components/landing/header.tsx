"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Database, Menu, X } from "lucide-react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"

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
    <header className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${
      scrolled 
        ? "py-4 bg-card border-b border-border" 
        : "py-6 bg-transparent"
    }`}>
      <div className="container px-6 max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">SaCMS</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "/#features" },
            { label: "Pricing", href: "/#pricing" },
            { label: "Addons", href: "/#addons" },
            { label: "Docs", href: "/docs" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              target={item.href === "/docs" ? "_blank" : undefined}
              rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="rounded-none text-muted-foreground hover:text-foreground hover:bg-transparent">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="rounded-none bg-primary hover:bg-primary/90 text-white transition-none">
                Get Started
              </Button>
            </Link>
          </div>
          
          <Button variant="ghost" size="icon" className="md:hidden rounded-none text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
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
            className="md:hidden border-t border-border bg-card overflow-hidden shadow-lg"
          >
            <nav className="container px-6 py-6 flex flex-col gap-4">
              {[
                { label: "Features", href: "/#features" },
                { label: "Pricing", href: "/#pricing" },
                { label: "Addons", href: "/#addons" },
                { label: "Documentation", href: "/docs" },
              ].map((item) => (
                <Link 
                  key={item.label} 
                  href={item.href} 
                  target={item.href === "/docs" ? "_blank" : undefined}
                  rel={item.href === "/docs" ? "noopener noreferrer" : undefined}
                  className="text-base font-medium text-foreground" 
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border">
                <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full rounded-none border-border">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-none bg-primary hover:bg-primary/90 text-white">
                    Get Started
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
