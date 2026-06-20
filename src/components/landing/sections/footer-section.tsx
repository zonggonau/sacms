import { Database } from "lucide-react"
import Link from "next/link"
import type { FooterData } from "../types"
import { Logo } from "@/components/ui/logo"

export function FooterSection({ footer }: { footer: FooterData | null }) {
  return (
    <footer className="pt-20 pb-10 bg-background border-t border-border/50 relative overflow-hidden">
      {/* Abstract Footer Glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] opacity-10 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent blur-3xl rounded-full" />
      </div>

      <div className="container px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-16">
          <div className="space-y-6">
            <Link href="/" className="inline-block">
              <Logo iconSize="lg" showText={true} useOrange={true} />
            </Link>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              {footer?.description || "Platform Headless CMS modern yang dirancang khusus untuk mempercepat transformasi digital di Papua dan Indonesia."}
            </p>
          </div>

          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-8">
            <div>
              <p className="font-black text-foreground mb-6 text-sm uppercase tracking-widest text-primary">Produk</p>
              <div className="space-y-4">
                <Link href="/#features" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Fitur</Link>
                <Link href="/#pricing" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Harga</Link>
                <Link href="/#addons" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Layanan Tambahan</Link>
                <Link href="/#sektor" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Sektor Layanan</Link>
              </div>
            </div>
            <div>
              <p className="font-black text-foreground mb-6 text-sm uppercase tracking-widest text-primary">Perusahaan</p>
              <div className="space-y-4">
                <Link href="/#about" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Tentang Kami</Link>
                <Link href="/#testimonials" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Testimoni</Link>
                <Link href="/#faq" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Tanya Jawab</Link>
              </div>
            </div>
            <div>
              <p className="font-black text-foreground mb-6 text-sm uppercase tracking-widest text-primary">Pengembang</p>
              <div className="space-y-4">
                <Link href="/docs" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Dokumentasi</Link>
                <Link href="/login" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Masuk Admin</Link>
                <Link href="/register" className="block text-muted-foreground hover:text-primary transition-colors font-medium">Daftar</Link>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-sm text-muted-foreground font-medium">
            © {new Date().getFullYear()} <span className="text-foreground font-bold">{footer?.brand_name || "SaCMS"}</span>. Hak cipta dilindungi.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <span>Dibangun dengan</span>
            <span className="px-2 py-1 bg-card rounded-md border border-border/50 text-foreground font-bold text-xs">Next.js 16</span>
            <span>+</span>
            <span className="px-2 py-1 bg-card rounded-md border border-border/50 text-foreground font-bold text-xs">Prisma</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
