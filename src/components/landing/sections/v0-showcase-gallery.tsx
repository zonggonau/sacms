"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, ArrowRight, Layers, Database, Code2, Globe, Check } from "lucide-react"

export interface ShowcaseProject {
  id: string
  title: string
  category: string
  description: string
  icon: string
  tags: string[]
  prompt: string
  features: string[]
  accentColor: string
}

export const SHOWCASE_PROJECTS: ShowcaseProject[] = [
  {
    id: "resort-bali",
    title: "Grand Ocean Resort & Diving",
    category: "Pariwisata & Hospitaliti",
    description: "Website resor tepi pantai dengan katalog tipe villa kamar, paket wisata menyelam, galeri foto interaktif, dan formulir reservasi online.",
    icon: "🏖️",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "Booking Engine"],
    prompt: "Buat website modern untuk Grand Resort & Pariwisata dengan katalog tipe kamar (Deluxe, Ocean Villa), paket wisata bahari/diving, fasilitas resto seafood, galeri foto, dan formulir booking reservasi online.",
    features: ["Katalog Kamar & Villa", "Paket Wisata & Diving", "Formulir Booking Tamu", "Integrasi WhatsApp"],
    accentColor: "from-sky-500/20 via-sky-500/5 to-transparent",
  },
  {
    id: "umkm-kopi",
    title: "Kopi Nusantara & UMKM Store",
    category: "E-Commerce & Retail",
    description: "Toko online produk kopi lokal nusantara dan kriya tangan dengan filter kategori, ulasan pelanggan, keranjang belanja, dan checkout instan via WhatsApp/QRIS.",
    icon: "☕",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "Midtrans Snap"],
    prompt: "Buat website toko online e-commerce untuk UMKM produk kopi dan kerajinan tangan, dengan katalog produk filterable, varian berat/ukuran, harga diskon, ulasan bintang, dan checkout WhatsApp instan.",
    features: ["Katalog Produk Varian", "Filter Kategori Dinamis", "Ulasan Bintang 5", "Checkout WhatsApp & QRIS"],
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  },
  {
    id: "portal-pemda",
    title: "Portal Informasi Publik Kabupaten",
    category: "Pemerintahan & Publik",
    description: "Portal resmi instansi pemerintah daerah dengan siaran pers berita terkini, agenda pimpinan, transparansi PPID, dan direktori layanan publik terpadu.",
    icon: "📰",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "Multi-Reviewer CMS"],
    prompt: "Rancang portal media berita digital modern dengan kategori topik (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks, headline breaking news, profil jurnalis, dan feed pengumuman publik.",
    features: ["Breaking News Banner", "Direktori Layanan Publik", "Dokumen Unduhan PPID", "Workflow Redaksi"],
    accentColor: "from-blue-500/20 via-blue-500/5 to-transparent",
  },
  {
    id: "klinik-medika",
    title: "Klinik Medika Sejahtera",
    category: "Kesehatan & Medis",
    description: "Website layanan klinik kesehatan terpadu dengan jadwal praktik dokter spesialis, informasi fasilitas laboratorium, artikel medis, dan booking janji temu pasien.",
    icon: "🏥",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "Patient Queue"],
    prompt: "Buat website profil klinik kesehatan modern dengan jadwal praktik dokter spesialis, direktori layanan medis & poliklinik, artikel kesehatan, dan formulir pendaftaran janji temu pasien.",
    features: ["Jadwal Dokter Real-time", "Poliklinik Spesialis", "Pendaftaran Pasien Online", "Artikel Edukasi"],
    accentColor: "from-emerald-500/20 via-emerald-500/5 to-transparent",
  },
  {
    id: "sekolah-ppdb",
    title: "SMK Unggulan Teknologi",
    category: "Pendidikan & Akademik",
    description: "Website profil sekolah kejuruan modern dengan informasi kompetensi keahlian, prestasi siswa, agenda akademik, galeri kegiatan, dan sistem pendaftaran PPDB online.",
    icon: "🎓",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "PPDB Engine"],
    prompt: "Rancang website institusi sekolah / kejuruan modern dengan profil sekolah, direktori jurusan/program keahlian, pengumuman akademik, galeri prestasi siswa, dan formulir pendaftaran PPDB online.",
    features: ["Direktori Jurusan", "Pengumuman Akademik", "Galeri Prestasi Siswa", "Formulir PPDB Online"],
    accentColor: "from-indigo-500/20 via-indigo-500/5 to-transparent",
  },
  {
    id: "agency-neostudio",
    title: "NeoStudio Creative Digital",
    category: "Agensi & Portofolio",
    description: "Portofolio agensi digital kreatif bergaya ultra-modern dark mode dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, dan formulir konsultasi.",
    icon: "💼",
    tags: ["Next.js 16", "TailwindCSS v4", "PostgreSQL 17", "Dark Aesthetic"],
    prompt: "Buat website portofolio agensi digital kreatif ultra-modern sleek dark mode dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, paket pricing harga, dan formulir konsultasi proyek.",
    features: ["Showcase Studi Kasus", "Testimoni Slider", "Tabel Paket Layanan", "Formulir Brief Klien"],
    accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
  },
]

/**
 * A "sandbox card" preview — a browser-chrome frame with a fake `.vercel.app`
 * address bar wrapped around a tiny CSS wireframe of a homepage (nav, hero,
 * content grid), in the project's accent color. These are prompt templates,
 * not real generated sites, so there's no live deployment to embed as an
 * iframe or screenshot — this is a purely decorative mockup, styled after
 * v0.app's own template gallery, not a claim that the URL shown is real or
 * clickable.
 */
function BrowserMockupPreview({ item }: { item: ShowcaseProject }) {
  return (
    <div className="relative h-40 overflow-hidden border-b border-border/50 shrink-0">
      <div className="h-7 flex items-center gap-1.5 px-3 bg-muted/70 border-b border-border/40">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <div className="ml-2 flex-1 h-4 rounded-full bg-background/80 border border-border/40 flex items-center px-2 min-w-0">
          <Globe className="h-2 w-2 text-muted-foreground/60 shrink-0 mr-1" />
          <span className="text-[8px] text-muted-foreground/70 font-mono truncate">{item.id}.vercel.app</span>
        </div>
      </div>

      <div className={`h-[calc(100%-1.75rem)] bg-gradient-to-b ${item.accentColor} p-3 flex flex-col gap-2`}>
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="h-4 w-4 rounded-md bg-card/90 shadow-xs flex items-center justify-center text-[8px] leading-none">
              {item.icon}
            </span>
            <div className="h-1.5 w-9 rounded-full bg-card/60" />
          </div>
          <div className="flex gap-1">
            <div className="h-1.5 w-4 rounded-full bg-card/40" />
            <div className="h-1.5 w-4 rounded-full bg-card/40" />
            <div className="h-1.5 w-4 rounded-full bg-card/40" />
          </div>
        </div>

        <div className="space-y-1 shrink-0">
          <div className="h-2 w-2/3 rounded-full bg-card/90" />
          <div className="h-1.5 w-1/2 rounded-full bg-card/50" />
        </div>

        <div className="grid grid-cols-3 gap-1.5 flex-1 min-h-0">
          <div className="rounded-md bg-card/70 border border-border/30" />
          <div className="rounded-md bg-card/70 border border-border/30" />
          <div className="rounded-md bg-card/70 border border-border/30" />
        </div>
      </div>
    </div>
  )
}

export function V0ShowcaseGallery() {
  const handleUsePrompt = (promptText: string) => {
    // Find composer textarea and populate
    const composerTextarea = document.querySelector("textarea")
    if (composerTextarea) {
      composerTextarea.value = promptText
      composerTextarea.dispatchEvent(new Event("input", { bubbles: true }))
      composerTextarea.focus()
      composerTextarea.scrollIntoView({ behavior: "smooth", block: "center" })
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  return (
    <section id="showcase" className="py-16 md:py-24 border-t border-border/40 bg-muted/20">
      <div className="container max-w-6xl mx-auto px-4 sm:px-6">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <Badge variant="outline" className="text-xs font-bold px-3 py-1 rounded-full border-primary/30 bg-primary/10 text-primary uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 mr-1.5 inline" />
            Showcase AI Blueprint
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-foreground">
            Inspirasi Website yang Dapat Dihasilkan
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Pilih blueprint yang sesuai dengan sektor bisnis Anda. AI akan merancang skema database, field CMS, dan frontend Next.js secara instan.
          </p>
        </div>

        {/* Showcase Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SHOWCASE_PROJECTS.map((item) => (
            <Card
              key={item.id}
              className="rounded-3xl border border-border/80 bg-card/90 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between group hover:border-primary/40"
            >
              <BrowserMockupPreview item={item} />

              <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg p-1.5 rounded-xl bg-muted/70 border border-border/60 shrink-0">
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block truncate">
                      {item.category}
                    </span>
                    <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                      {item.title}
                    </h3>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.description}
                </p>

                {/* Features Checklist */}
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  {item.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2 text-xs text-foreground/80 font-medium">
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {item.tags.map((tag, tIdx) => (
                    <span
                      key={tIdx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-muted text-muted-foreground border border-border/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Action CTA */}
                <div className="pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    onClick={() => handleUsePrompt(item.prompt)}
                    className="w-full h-8.5 text-xs font-bold rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 transition-all gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Coba Prompt Ini</span>
                    <ArrowRight className="h-3 w-3 ml-auto" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
