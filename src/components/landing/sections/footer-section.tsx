"use client"

import Link from "next/link"
import type { FooterData } from "../types"
import { Logo } from "@/components/ui/logo"

export function FooterSection({ footer }: { footer: FooterData | null }) {
  const brandDesc = footer?.description || "SaCMS — Smart Content Management System. Build smarter. Manage easier. Scale faster. Platform SaaS Headless CMS terdepan untuk transformasi digital."

  return (
    <footer className="pt-20 pb-10 bg-background border-t border-border/50 relative overflow-hidden">
      {/* Abstract Footer Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          <div className="space-y-4">
            <Link href="/" className="inline-block">
              <Logo iconSize="md" showText={true} showDetail={true} useOrange={true} />
            </Link>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm font-medium">
              {brandDesc}
            </p>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <p className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest text-primary">
                Produk
              </p>
              <div className="space-y-3 text-xs sm:text-sm">
                <Link href="/#fitur" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Fitur
                </Link>
                <Link href="/#pricing" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Harga
                </Link>
                <Link href="/#addons" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Ekstra & Booster
                </Link>
                <Link href="/#sektor" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Solusi Sektoral
                </Link>
              </div>
            </div>

            <div>
              <p className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest text-primary">
                Perusahaan
              </p>
              <div className="space-y-3 text-xs sm:text-sm">
                <Link href="/#about" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Tentang
                </Link>
                <Link href="/#testimonials" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Testimoni
                </Link>
                <Link href="/#faq" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Pertanyaan Umum
                </Link>
              </div>
            </div>

            <div>
              <p className="font-bold text-foreground mb-4 text-xs uppercase tracking-widest text-primary">
                Sumber Daya
              </p>
              <div className="space-y-3 text-xs sm:text-sm">
                <Link href="/docs" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Docs
                </Link>
                <Link href="/login" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Masuk
                </Link>
                <Link href="/register" className="block text-muted-foreground hover:text-primary transition-colors font-medium">
                  Mulai Gratis
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            © {new Date().getFullYear()} <span className="text-foreground font-bold">{footer?.brand_name || "SaCMS"}</span>. Hak cipta dilindungi undang-undang. Smart Content Management System.
          </p>
        </div>
      </div>
    </footer>
  )
}
