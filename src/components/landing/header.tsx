"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Menu, X } from "lucide-react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"

export function LandingHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-zinc-100 dark:border-zinc-900 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
      <div className="container px-6 max-w-5xl mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-zinc-900 dark:bg-white flex items-center justify-center">
            <Database className="w-3.5 h-3.5 text-white dark:text-zinc-900" />
          </div>
          <Link href="/">
             <span className="text-sm font-bold tracking-tighter uppercase">SaCMS</span>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "#features" },
            { label: "About", href: "#about" },
            { label: "Pricing", href: "#pricing" },
            { label: "Docs", href: "/docs" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-4 border-l border-zinc-100 dark:border-zinc-800 pl-4 ml-2">
            <Link href="/login">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer transition-colors">Sign In</span>
            </Link>
            <Link href="/register">
              <Button size="sm" className="h-8 px-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 text-[10px] font-bold uppercase tracking-widest rounded-md">
                Join
              </Button>
            </Link>
          </div>
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-white dark:bg-zinc-950 animate-in slide-in-from-top duration-300">
          <nav className="container px-6 py-6 flex flex-col gap-4">
            {[
              { label: "Features", href: "#features" },
              { label: "Pricing", href: "#pricing" },
              { label: "Docs", href: "/docs" },
            ].map((item) => (
              <Link 
                key={item.label} 
                href={item.href} 
                className="text-[10px] font-bold uppercase tracking-widest text-zinc-500" 
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <span className="text-[10px] font-bold uppercase tracking-widest">Sign In</span>
              </Link>
              <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Join Free</span>
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
