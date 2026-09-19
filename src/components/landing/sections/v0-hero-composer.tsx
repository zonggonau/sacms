"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  ArrowUp,
  Database,
  Layers,
  Zap,
  LayoutDashboard,
  Shield,
  ArrowRight,
  Code2,
} from "lucide-react"
import type { HeroData } from "../types"

export const V0_PROMPT_SUGGESTIONS = [
  {
    icon: "🏖️",
    title: "Resor & Pariwisata",
    prompt: "Buat website modern untuk Grand Resort & Pariwisata dengan katalog tipe kamar (Deluxe, Ocean Villa), paket wisata bahari/diving, fasilitas resto seafood, galeri foto, dan formulir booking reservasi online.",
  },
  {
    icon: "☕",
    title: "Toko Online UMKM",
    prompt: "Buat website toko online e-commerce untuk UMKM produk kopi dan kerajinan tangan, dengan katalog produk filterable, varian berat/ukuran, harga diskon, ulasan bintang, dan checkout WhatsApp instan.",
  },
  {
    icon: "📰",
    title: "Portal Berita Daerah",
    prompt: "Rancang portal media berita digital modern dengan kategori topik (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks, headline breaking news, profil jurnalis, dan feed pengumuman publik.",
  },
  {
    icon: "🏥",
    title: "Klinik & Janji Dokter",
    prompt: "Buat website profil klinik kesehatan modern dengan jadwal praktik dokter spesialis, direktori layanan medis & poliklinik, artikel kesehatan, dan formulir pendaftaran janji temu pasien.",
  },
  {
    icon: "🎓",
    title: "Sekolah & PPDB",
    prompt: "Rancang website institusi sekolah / kejuruan modern dengan profil sekolah, direktori jurusan/program keahlian, pengumuman akademik, galeri prestasi siswa, dan formulir pendaftaran PPDB online.",
  },
  {
    icon: "💼",
    title: "Agensi Portofolio",
    prompt: "Buat website portofolio agensi digital kreatif ultra-modern sleek dark mode dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, paket pricing harga, dan formulir konsultasi proyek.",
  },
]

interface V0HeroComposerProps {
  data?: HeroData | null
}

export function V0HeroComposer({ data }: V0HeroComposerProps = {}) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [prompt, setPrompt] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const badgeText = data?.badge_text || "SaCMS AI Studio v2 • Powered by Next.js 16 & PostgreSQL 17"
  const headlineText = data?.headline || "What can I build for you today?"
  const rawSubheadline = data?.subheadline ? data.subheadline.replace(/<[^>]*>/g, "") : ""
  const subheadlineText = rawSubheadline || "Rancang arsitektur database, skema CMS dinamis, dan aplikasi web Next.js full-stack siap produksi hanya dengan satu kalimat prompt."

  // Auto-resize textarea as content grows
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`
    }
  }, [prompt])

  const handleSelectSuggestion = (suggestedPrompt: string) => {
    setPrompt(suggestedPrompt)
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleGenerate = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) {
      toast({
        title: "Prompt Belum Diisi",
        description: "Silakan ketik kebutuhan website atau pilih salah satu inspirasi prompt di bawah.",
        variant: "destructive",
      })
      textareaRef.current?.focus()
      return
    }

    setIsSubmitting(true)

    try {
      // Save prompt to storage for seamless transfer
      if (typeof window !== "undefined") {
        sessionStorage.setItem("sacms_pending_prompt", cleanPrompt)
        localStorage.setItem("sacms_pending_prompt", cleanPrompt)
      }

      const targetUrl = `/dashboard/ai-builder?prompt=${encodeURIComponent(cleanPrompt)}`

      if (status === "authenticated" && session?.user) {
        // Logged in: direct jump to AI Website Builder in dashboard
        router.push(targetUrl)
      } else {
        // Not logged in: go to login, then redirect to aibuilder
        const loginUrl = `/login?redirect_to=${encodeURIComponent(targetUrl)}`
        router.push(loginUrl)
      }
    } catch {
      router.push("/login?redirect_to=/dashboard/ai-builder")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleGenerate()
    }
  }

  return (
    <section className="relative pt-24 pb-14 md:pt-32 md:pb-20 overflow-hidden">
      {/* Ambient background glow & radial gradient */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[1000px] h-[450px] bg-gradient-to-tr from-primary/25 via-blue-500/15 to-transparent blur-3xl rounded-full pointer-events-none opacity-60" />

      <div className="container relative z-10 max-w-5xl mx-auto px-4 sm:px-6 text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide mb-6 backdrop-blur-md shadow-xs animate-in fade-in slide-in-from-bottom-2 duration-500">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
          <span>{badgeText}</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.15] max-w-4xl mx-auto mb-4 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
          {headlineText}
        </h1>

        {/* Subtitle */}
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium max-w-2xl mx-auto mb-8 leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
          {subheadlineText}
        </p>

        {/* Central v0.app-Style Prompt Composer */}
        <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-5 duration-700 delay-300">
          <form
            onSubmit={handleGenerate}
            className="relative rounded-3xl border border-border/80 bg-card/90 backdrop-blur-xl shadow-2xl shadow-primary/5 p-3 sm:p-4 text-left focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300 group"
          >
            {/* Input Textarea */}
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask SaCMS to build a website, portal, e-commerce, or web app (contoh: Website resor pariwisata bahari lengkap dengan booking kamar, galeri foto, dan kontak WhatsApp)..."
              rows={2}
              className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground/70 resize-none outline-none border-0 p-1.5 min-h-[64px] max-h-[180px] leading-relaxed font-normal"
            />

            {/* Bottom Controls Bar inside Input Card */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-1 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge
                  variant="outline"
                  className="rounded-full px-2.5 py-0.5 font-bold border-primary/30 bg-primary/10 text-primary text-[11px] gap-1"
                >
                  <Zap className="h-3 w-3 fill-primary" />
                  SaCMS AI Pro
                </Badge>
                <Badge
                  variant="secondary"
                  className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] text-muted-foreground hidden sm:inline-flex gap-1"
                >
                  <Database className="h-3 w-3 text-emerald-500" />
                  PostgreSQL 17 Native
                </Badge>
                <Badge
                  variant="secondary"
                  className="rounded-full px-2.5 py-0.5 font-semibold text-[11px] text-muted-foreground hidden md:inline-flex gap-1"
                >
                  <Code2 className="h-3 w-3 text-blue-500" />
                  Next.js 16 App Router
                </Badge>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "h-9 px-4 rounded-xl font-bold text-xs shadow-xs transition-all gap-1.5 cursor-pointer",
                  prompt.trim()
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25 hover:scale-[1.02]"
                    : "bg-muted text-muted-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isSubmitting ? "Menyiapkan..." : "Generate Website"}</span>
                <ArrowUp className="h-3.5 w-3.5 ml-0.5" />
              </Button>
            </div>
          </form>

          {/* Quick Prompt Suggestion Pills */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground text-[11px] font-bold mr-1 hidden sm:inline">
              Inspirasi Cepat:
            </span>
            {V0_PROMPT_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSuggestion(item.prompt)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/70 bg-card/70 hover:bg-card hover:border-primary/40 text-foreground/80 hover:text-foreground text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
              >
                <span>{item.icon}</span>
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto pt-10 mt-6 border-t border-border/40 text-left animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
          <div className="p-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-primary font-bold text-xs mb-1">
              <Database className="h-4 w-4" />
              <span>Dedicated PostgreSQL</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Database appliance terisolasi penuh dengan koneksi pooling enterprise.
            </p>
          </div>

          <div className="p-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-blue-500 font-bold text-xs mb-1">
              <Zap className="h-4 w-4" />
              <span>Edge Custom DNS</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Manajemen DNS domain kustom ala Vercel dengan auto routing SSL.
            </p>
          </div>

          <div className="p-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs mb-1">
              <Sparkles className="h-4 w-4" />
              <span>MCP &amp; AI Generator</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              AI cerdas yang menghubungkan kode frontend langsung ke live API SaCMS.
            </p>
          </div>

          <div className="p-3 rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xs">
            <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs mb-1">
              <Shield className="h-4 w-4" />
              <span>Role-Based CMS</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Manajemen konten multi-reviewer dengan status draft, review, dan publish.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
