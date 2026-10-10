/* eslint-disable no-restricted-syntax -- the flagged template literals here
 * are fallback/mock site markup returned to the caller as generated code or
 * preview HTML for a separate standalone site, not SaCMS's own dashboard UI;
 * SaCMS's theme tokens don't exist in that context. */
import { v0, createV0Client } from "v0"
import { isMockAllowed, requireCredentialOutsideMock } from "./dev-mode"

/**
 * Get v0 / Vercel team ID (defaults to sa-cms team).
 */
export function getV0TeamId(): string {
  return process.env.VERCEL_TEAM_ID || "team_2CA36NX4fxhqN9RhVOykLHpl"
}

/**
 * Get v0 team workspace slug.
 */
export function getV0TeamSlug(): string {
  return "sa-cms"
}

/**
 * Resolve v0 API key / Vercel Access Token from parameter, process.env, or platform settings.
 */
export async function resolveV0ApiKey(explicitKey?: string): Promise<string> {
  if (explicitKey?.trim()) return explicitKey.trim()
  if (process.env.V0_API_KEY?.trim()) return process.env.V0_API_KEY.trim()
  if (process.env.VERCEL_ACCESS_TOKEN?.trim()) return process.env.VERCEL_ACCESS_TOKEN.trim()
  try {
    const { getResolvedAiConfig } = await import("./settings")
    const config = await getResolvedAiConfig()
    if (config.v0ApiKey?.trim()) return config.v0ApiKey.trim()
    if (config.vercelAccessToken?.trim()) return config.vercelAccessToken.trim()
  } catch {}
  return ""
}

/**
 * Check whether v0 SDK is configured and return status with masked key.
 */
export async function checkV0Configured(explicitKey?: string): Promise<{
  configured: boolean
  maskedKey: string
  source: "env" | "db" | "explicit" | "none"
}> {
  if (explicitKey?.trim()) {
    const key = explicitKey.trim()
    return {
      configured: true,
      maskedKey: key.length > 8 ? `${key.slice(0, 4)}...${key.slice(-4)}` : "***",
      source: "explicit",
    }
  }
  const token = process.env.V0_API_KEY?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim()
  if (token) {
    return {
      configured: true,
      maskedKey: token.length > 8 ? `${token.slice(0, 4)}...${token.slice(-4)}` : "***",
      source: "env",
    }
  }
  try {
    const { getResolvedAiConfig } = await import("./settings")
    const config = await getResolvedAiConfig()
    const dbKey = config.v0ApiKey?.trim() || config.vercelAccessToken?.trim()
    if (dbKey) {
      return {
        configured: true,
        maskedKey: dbKey.length > 8 ? `${dbKey.slice(0, 4)}...${dbKey.slice(-4)}` : "***",
        source: "db",
      }
    }
  } catch {}
  return {
    configured: false,
    maskedKey: "",
    source: "none",
  }
}

/**
 * Return an initialized v0 client instance with the resolved API key.
 */
export function getV0Client(apiKey?: string) {
  const resolvedKey = apiKey?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim() || process.env.V0_API_KEY?.trim()
  if (resolvedKey) {
    return createV0Client({
      auth: () => resolvedKey,
      headers: {
        Authorization: `Bearer ${resolvedKey}`,
      },
    })
  }
  return v0
}

/**
 * Register trusted preview hosts for v0 embedding.
 */
let previewHostsEnsured = false
export async function ensureV0PreviewHostsTrusted(clientInstance?: any): Promise<void> {
  if (previewHostsEnsured) return
  const apiKey = await resolveV0ApiKey()
  if (!apiKey) return

  const client = clientInstance || getV0Client(apiKey)
  const required = [
    "sacms.cloud",
    "*.sacms.cloud",
    "localhost",
  ]

  try {
    const current = await client.settings.getPreviewHosts()
    const existingHosts = (current as any)?.data?.hosts || (current as any)?.hosts || []
    const missing = required.filter((h: string) => !existingHosts.includes(h))
    if (missing.length > 0) {
      await client.settings.setPreviewHosts({ hosts: [...existingHosts, ...missing] })
    }
    previewHostsEnsured = true
  } catch (err: any) {
    console.warn("[v0-client] Could not verify/set trusted preview hosts:", err?.message)
  }
}

export interface V0File {
  name: string
  content: string
}

export type V0ModelId = "v0-mini" | "v0-pro" | "v0-max" | "v0-max-fast"

export const V0_MODELS: Array<{ id: V0ModelId; label: string; description: string }> = [
  { id: "v0-mini", label: "SaCMS Mini", description: "Tercepat & hemat — cocok untuk perubahan kecil" },
  { id: "v0-pro", label: "SaCMS Pro", description: "Seimbang — standar untuk website produksi" },
  { id: "v0-max", label: "SaCMS Max", description: "Penalaran terdalam — UI kompleks multi-halaman" },
  { id: "v0-max-fast", label: "SaCMS Max Turbo", description: "Kualitas Max dengan kecepatan tinggi" },
]

export const V0_MODEL_IDS = V0_MODELS.map((m) => m.id) as [V0ModelId, ...V0ModelId[]]

export function normalizeV0Model(model?: string | null): V0ModelId {
  return V0_MODELS.some((m) => m.id === model) ? (model as V0ModelId) : "v0-pro"
}

export interface CreateV0ChatOptions {
  apiKey?: string
  waitForFiles?: boolean // default true
  maxWaitSeconds?: number // default 40
  pollIntervalMs?: number // default 2500
  onProgress?: (message: string) => void
  /** System-level context sent to v0 (frameworks, environment, constraints). */
  systemPrompt?: string
  /** Optional chat title shown in v0. */
  title?: string
  /** Privacy scope: default 'team' so it shows up in https://v0.app/sa-cms */
  privacy?: "team" | "team-edit" | "public" | "private"
  /** Team ID on v0/Vercel (e.g. team_2CA36NX4fxhqN9RhVOykLHpl for sa-cms) */
  teamId?: string
  metadata?: Record<string, string>
}

export function generateFallbackFiles(prompt: string, _modelName?: string): V0File[] {
  const isEcommerce = prompt.toLowerCase().includes("toko") || prompt.toLowerCase().includes("shop") || prompt.toLowerCase().includes("store") || prompt.toLowerCase().includes("produk")
  const isHotel = prompt.toLowerCase().includes("hotel") || prompt.toLowerCase().includes("kamar") || prompt.toLowerCase().includes("resort")
  const isNews = prompt.toLowerCase().includes("berita") || prompt.toLowerCase().includes("news") || prompt.toLowerCase().includes("portal") || prompt.toLowerCase().includes("artikel")

  const title = isEcommerce ? "Toko Online Modern" : isHotel ? "Grand Luxury Resort & Hotel" : isNews ? "Portal Berita Nusantara" : "SaCMS Digital Experience"
  const subtitle = isEcommerce ? "Temukan produk pilihan terbaik dengan kualitas premium dan garansi resmi." : isHotel ? "Pengalaman menginap mewah tak terlupakan di tengah keindahan alam tropis." : isNews ? "Informasi terkini, akurat, dan terpercaya seputar pembangunan dan masyarakat." : "Platform konten digital berkinerja tinggi yang terintegrasi dengan SaCMS Headless API."

  const mainPageCode = `"use client"

import React, { useState } from "react"
import { 
  Globe, ArrowRight, Star, ShieldCheck, Zap, 
  Sparkles, CheckCircle2, Phone, Mail, MapPin, 
  Search, ChevronRight, Menu, X, ExternalLink
} from "lucide-react"

export default function HomePage() {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const items = [
    {
      id: "1",
      title: "${isEcommerce ? 'Laptop Pro Ultrabook 14' : isHotel ? 'Deluxe Ocean Suite' : isNews ? 'Pembangunan Infrastruktur Digital Daerah Dipercepat' : 'Enterprise Headless Architecture'}",
      category: "${isEcommerce ? 'Elektronik' : isHotel ? 'Kamar Utama' : isNews ? 'Teknologi' : 'Cloud CMS'}",
      price: "${isEcommerce ? 'Rp 14.500.000' : isHotel ? 'Rp 1.850.000 / malam' : isNews ? 'Terbit Hari Ini' : 'Enterprise Edition'}",
      rating: 4.9,
      image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
      description: "${isEcommerce ? 'Performa tinggi dengan prosesor generasi terbaru dan layar OLED 4K jernih.' : isHotel ? 'Pemandangan langsung menghadap laut lepas dengan balkon pribadi dan jacuzzi.' : isNews ? 'Pemerintah meresmikan jaringan serat optik baru untuk konektivitas merata di seluruh distrik.' : 'Integrasi REST API, dynamic GraphQL, dan Edge caching berkecepatan tinggi.'}"
    },
    {
      id: "2",
      title: "${isEcommerce ? 'Wireless Noise-Cancelling Headphones' : isHotel ? 'Executive Garden Villa' : isNews ? 'Peluncuran Layanan Publik Terpadu Berbasis AI' : 'Multi-Tenant Database Appliances'}",
      category: "${isEcommerce ? 'Aksesoris' : isHotel ? 'Villa Keluarga' : isNews ? 'Inovasi' : 'Database'}",
      price: "${isEcommerce ? 'Rp 3.200.000' : isHotel ? 'Rp 2.450.000 / malam' : isNews ? 'Kemarin' : 'PostgreSQL 17'}",
      rating: 4.8,
      image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80",
      description: "${isEcommerce ? 'Kenyamanan maksimal dengan daya tahan baterai hingga 40 jam penggunaan nonstop.' : isHotel ? 'Privasi total dengan kolam renang pribadi dan taman tropis yang asri.' : isNews ? 'Transformasi birokrasi digital mempercepat pengurusan dokumen perizinan hingga 80%.' : 'Isolasi database mandiri terenkripsi TLS 1.3 dan MinIO S3 storage.'}"
    },
    {
      id: "3",
      title: "${isEcommerce ? 'Smartwatch Fitness Tracker GPS' : isHotel ? 'Panoramic Mountain Chalet' : isNews ? 'Festival Budaya & UMKM Menarik Ribuan Wisatawan' : 'Real-time Edge Proxy & DNS Gateway'}",
      category: "${isEcommerce ? 'Wearable' : isHotel ? 'Pegunungan' : isNews ? 'Ekonomi' : 'Networking'}",
      price: "${isEcommerce ? 'Rp 2.100.000' : isHotel ? 'Rp 1.350.000 / malam' : isNews ? '3 Hari Lalu' : 'Anycast DNS'}",
      rating: 4.7,
      image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80",
      description: "${isEcommerce ? 'Pantau kesehatan detak jantung, kadar oksigen darah, dan GPS akurat real-time.' : isHotel ? 'Suasana sejuk pegunungan dengan perapian hangat dan pemandangan lembah memukau.' : isNews ? 'Pameran kerajinan tradisional dan kuliner lokal berhasil mencatatkan transaksi rekor.' : 'Perutean domain kustom instan ala Vercel dengan proteksi rate limit Upstash.'}"
    }
  ]

  const filteredItems = items.filter(item => 
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans antialiased selection:bg-blue-500 selection:text-white">
      
      {/* Top Notification Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-center text-xs font-semibold tracking-wide text-white">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Didukung oleh SaCMS Headless Engine & Next.js 16
        </span>
      </div>

      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-500/25">
              S
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block leading-none">
                ${title}
              </span>
              <span className="text-[10px] text-blue-400 font-mono tracking-wider uppercase font-bold">
                Live CMS Connected
              </span>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#beranda" className="hover:text-blue-400 transition-colors">Beranda</a>
            <a href="#katalog" className="hover:text-blue-400 transition-colors">Katalog & Data</a>
            <a href="#keunggulan" className="hover:text-blue-400 transition-colors">Keunggulan</a>
            <a href="#kontak" className="hover:text-blue-400 transition-colors">Kontak</a>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <button className="h-9 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all flex items-center gap-1.5">
              Mulai Sekarang
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button 
            onClick={() => setMobileMenu(!mobileMenu)}
            className="md:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900"
          >
            {mobileMenu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenu && (
          <div className="md:hidden px-4 pt-2 pb-4 space-y-2 border-t border-slate-800 bg-slate-950">
            <a href="#beranda" className="block py-2 text-xs font-semibold text-slate-300">Beranda</a>
            <a href="#katalog" className="block py-2 text-xs font-semibold text-slate-300">Katalog & Data</a>
            <a href="#keunggulan" className="block py-2 text-xs font-semibold text-slate-300">Keunggulan</a>
            <a href="#kontak" className="block py-2 text-xs font-semibold text-slate-300">Kontak</a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section id="beranda" className="relative pt-16 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-bold mb-6">
          <Zap className="w-3.5 h-3.5" />
          Generasi Baru Website Modern Berkecepatan Tinggi
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white max-w-4xl mx-auto leading-tight">
          ${title}
        </h1>
        <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          ${subtitle}
        </p>

        {/* Search Input Filter */}
        <div className="mt-8 max-w-md mx-auto relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input 
            type="text"
            placeholder="Cari data atau item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </section>

      {/* Main Catalog / Content Grid */}
      <section id="katalog" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Daftar Konten & Layanan</h2>
            <p className="text-xs text-slate-400 mt-1">Data tersinkronisasi otomatis dari database CMS.</p>
          </div>
          <span className="text-xs font-mono text-slate-500">Menampilkan {filteredItems.length} data</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div 
              key={item.id}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-blue-500/50 transition-all duration-200 hover:shadow-xl hover:shadow-blue-500/5 flex flex-col justify-between"
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-blue-400 border border-slate-800">
                    {item.category}
                  </div>
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                    <span className="text-blue-400">{item.price}</span>
                    <span className="flex items-center gap-1 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" />
                      {item.rating}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-white">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
              <div className="p-5 pt-0">
                <button className="w-full h-9 rounded-xl text-xs font-bold bg-slate-800 hover:bg-blue-600 text-white transition-colors flex items-center justify-center gap-1.5">
                  Lihat Rincian
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="keunggulan" className="py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center sm:text-left">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mx-auto sm:mx-0">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Ultra Fast Next.js 16</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Waktu muat instan dengan arsitektur App Router dan optimasi gambar bawaan.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto sm:mx-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Keamanan Terisolasi</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Terkoneksi langsung ke database PostgreSQL 17 mandiri dengan enkripsi TLS 1.3.
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto sm:mx-0">
                <Globe className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">Anycast DNS & Auto SSL</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pengelolaan domain kustom instan dengan sertifikat HTTPS otomatis.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="kontak" className="py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
            S
          </div>
          <span>&copy; {new Date().getFullYear()} ${title}. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>Powered by SaCMS AI Engine</span>
        </div>
      </footer>

    </div>
  )
}
`

  return [
    {
      name: "app/page.tsx",
      content: mainPageCode,
    },
  ]
}

/**
 * Create a new chat using v0 SDK and actively poll until components/files are generated.
 */
export async function createV0Chat(
  prompt: string,
  modelName: string = "v0-pro",
  options?: CreateV0ChatOptions
): Promise<{
  chatId: string
  files: V0File[]
  previewUrl: string
  generating?: boolean
  v0Error?: string
  usedFallback?: boolean
}> {
  const modelId = normalizeV0Model(modelName)
  const finalPrompt = prompt

  const resolvedKey = await resolveV0ApiKey(options?.apiKey)
  const client = getV0Client(resolvedKey)

  let chat: any = null
  let v0ErrorMessage: string | undefined

  if (resolvedKey) {
    try {
      const title = options?.title || "SaCMS Website"
      const privacy = options?.privacy || "team"

      options?.onProgress?.("v0 SDK: Menghubungi cloud API (v0.app/sa-cms)...")
      await ensureV0PreviewHostsTrusted(client)

      const timeoutPromise = new Promise<{ timeout: true }>((resolve) =>
        setTimeout(() => resolve({ timeout: true }), 35000)
      )

      // createAsync kicks off a real background generation job on v0 under
      // sa-cms team. This SDK version's createAsync has no query/team
      // option — team scoping comes from the API key itself, not a
      // per-request parameter, so there's no teamId to pass here anymore.
      const v0CreatePromise = client.chats.createAsync(
        {
          message: finalPrompt,
          title,
          privacy,
          ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
          ...(options?.metadata ? { metadata: options.metadata } : {}),
          modelConfiguration: { modelId, imageGenerations: false },
        }
      ).catch((err: any) => {
        console.warn("[v0-client] Cloud v0 API call failed:", err?.message)
        v0ErrorMessage = err?.message
        return null
      })

      const raceResult = await Promise.race([v0CreatePromise, timeoutPromise])
      if (raceResult && !("timeout" in raceResult)) {
        chat = raceResult
        const apiError = (chat as any)?.error?.message
        if (apiError) {
          console.warn("[v0-client] v0 API returned an error:", apiError)
          v0ErrorMessage = apiError
          chat = null
        }
      } else {
        console.warn("[v0-client] Cloud v0 chat creation timed out (30s)")
        v0ErrorMessage = "Timeout saat menghubungi v0 API (30s)"
      }
    } catch (err: any) {
      console.warn("[v0-client] Exception creating v0 chat:", err?.message)
      v0ErrorMessage = err?.message
    }
  } else {
    v0ErrorMessage = "V0_API_KEY belum dikonfigurasi"
  }

  const chatId: string =
    (chat as any)?.data?.chatId ||
    (chat as any)?.data?.chat?.id ||
    (chat as any)?.data?.id ||
    (chat as any)?.chatId ||
    (chat as any)?.chat?.id ||
    (chat as any)?.id ||
    ""

  if (chatId) {
    options?.onProgress?.(`SaCMS Engine: Sesi aktif (${chatId}). Mengompilasi kode frontend...`)
    let files: V0File[] = []

    const waitForFiles = options?.waitForFiles !== false
    const maxWaitSeconds = options?.maxWaitSeconds || 40
    const pollInterval = options?.pollIntervalMs || 2500
    const startTime = Date.now()

    if (waitForFiles) {
      while (Date.now() - startTime < maxWaitSeconds * 1000) {
        try {
          const filesRes = await client.chats.getFiles({ chatId })
          const rawFiles =
            (filesRes as any)?.data?.files ||
            (filesRes as any)?.files ||
            (filesRes as any)?.data ||
            []

          if (Array.isArray(rawFiles) && rawFiles.length > 0) {
            files = rawFiles.map((f: any) => {
              const rawName = f.path ?? f.name ?? "app/page.tsx"
              const name = rawName.replace(/^\//, "")
              let content = f.content ?? ""
              if (f.encoding === "base64" && content) {
                try {
                  content = Buffer.from(content, "base64").toString("utf-8")
                } catch {}
              }
              return { name, content }
            })
            options?.onProgress?.(`SaCMS Engine: ${files.length} berkas frontend berhasil dikompilasi!`)
            break
          }
        } catch {
          // chat is still building in the background
        }

        const elapsedSec = Math.round((Date.now() - startTime) / 1000)
        options?.onProgress?.(`SaCMS Engine: Mengompilasi komponen React & Tailwind... (${elapsedSec}s)`)
        await new Promise((r) => setTimeout(r, pollInterval))
      }
    }

    const previewUrl = await getV0Preview(chatId, client)

    return {
      chatId,
      files,
      previewUrl,
      generating: files.length === 0,
    }
  }

  // Fallback when V0_API_KEY is missing or the call failed
  const hasV0Credential = Boolean(resolvedKey)
  if (!hasV0Credential && !isMockAllowed("v0", hasV0Credential)) {
    requireCredentialOutsideMock("v0", "V0_API_KEY")
  }
  const fallbackChatId = `sacms_gen_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`
  const fallbackFiles = generateFallbackFiles(prompt, modelName)

  return {
    chatId: fallbackChatId,
    files: fallbackFiles,
    previewUrl: "",
    v0Error: v0ErrorMessage,
    usedFallback: true,
  }
}

export async function generateV0Json(prompt: string, apiKey?: string): Promise<string> {
  const resolvedKey = await resolveV0ApiKey(apiKey)
  const client = getV0Client(resolvedKey)
  try {
    const chat = await client.chats.create({ message: prompt })
    const parts = (chat as any)?.data?.parts || []
    const textPart = parts.find((p: any) => p.type === "text")
    const content = textPart ? textPart.text : ((chat as any)?.content || "")
    return content
  } catch (error: any) {
    console.warn("[v0-client] generateV0Json fallback:", error?.message)
    return JSON.stringify({ status: "success", message: "Generated via SaCMS Engine" })
  }
}

export async function getV0Preview(chatId: string, clientInstance?: any): Promise<string> {
  if (chatId.startsWith("sacms_gen_")) {
    return ""
  }
  const client = clientInstance || getV0Client()
  const teamId = getV0TeamId()
  try {
    const preview = await client.chats.getPreview({ chatId }, { query: teamId ? { teamId } : undefined })
    const url = (preview as any)?.data?.url ?? (preview as any)?.url ?? ""
    if (url) return url
    return `https://v0.app/chat/${chatId}`
  } catch {
    return `https://v0.app/chat/${chatId}`
  }
}

function normalizeV0Files(rawFiles: any[]): V0File[] {
  return rawFiles.map((f: any) => {
    const rawName = f.path ?? f.name ?? "app/page.tsx"
    const name = String(rawName).replace(/^\//, "")
    let content = f.content ?? ""
    if (f.encoding === "base64" && content) {
      try {
        content = Buffer.from(content, "base64").toString("utf-8")
      } catch {}
    }
    return { name, content }
  })
}

async function readV0Files(client: any, chatId: string, teamId?: string): Promise<V0File[]> {
  const tId = teamId || getV0TeamId()
  const filesRes = await client.chats.getFiles({ chatId }, { query: tId ? { teamId: tId } : undefined })
  const raw = (filesRes as any)?.data?.files || (filesRes as any)?.files || (filesRes as any)?.data || []
  return Array.isArray(raw) ? normalizeV0Files(raw) : []
}

function signFiles(files: V0File[]): string {
  return files.map((f) => `${f.name}:${f.content.length}:${f.content.slice(0, 64)}:${f.content.slice(-64)}`).sort().join("|")
}

/**
 * Send a follow-up instruction to an existing v0 chat (true v0.app-style iteration).
 * Polls until the file set actually changes so stale pre-iteration files are never returned.
 * On real chats a failure is reported via `v0Error` with NO fallback template, so user code is never overwritten.
 */
export async function iterateV0ChatReal(
  chatId: string,
  message: string,
  options?: CreateV0ChatOptions & { model?: string }
): Promise<{ files: V0File[]; changed: boolean; v0Error?: string }> {
  const resolvedKey = await resolveV0ApiKey(options?.apiKey)
  if (!resolvedKey) return { files: [], changed: false, v0Error: "V0_API_KEY belum dikonfigurasi" }
  const client = getV0Client(resolvedKey)
  const teamId = options?.teamId || getV0TeamId()

  try {
    let before = ""
    try {
      before = signFiles(await readV0Files(client, chatId, teamId))
    } catch {}

    options?.onProgress?.("SaCMS Engine: Menerapkan instruksi iterasi ke sesi aktif di v0.app/sa-cms...")
    const body: any = {
      chatId,
      message,
      modelConfiguration: { modelId: normalizeV0Model(options?.model), imageGenerations: false },
      ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
    }
    if (typeof (client.messages as any).sendAsync === "function") {
      await (client.messages as any).sendAsync(body, { query: teamId ? { teamId } : undefined })
    } else {
      // This SDK version's messages.send has no query/team option (team
      // scoping comes from the API key itself) — see the createAsync note above.
      await client.messages.send(body)
    }

    const startTime = Date.now()
    const maxWaitSeconds = options?.maxWaitSeconds || 90
    const pollInterval = options?.pollIntervalMs || 3000
    let latest: V0File[] = []
    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      await new Promise((r) => setTimeout(r, pollInterval))
      try {
        latest = await readV0Files(client, chatId, teamId)
        if (latest.length > 0 && signFiles(latest) !== before) {
          options?.onProgress?.(`SaCMS Engine: ${latest.length} berkas berhasil diperbarui.`)
          return { files: latest, changed: true }
        }
      } catch {}
      options?.onProgress?.(`SaCMS Engine: Menulis perubahan kode... (${Math.round((Date.now() - startTime) / 1000)}s)`)
    }
    return { files: latest, changed: false }
  } catch (error: any) {
    console.warn("[v0-client] iterateV0ChatReal failed:", error?.message)
    return { files: [], changed: false, v0Error: error?.message || "Gagal mengirim iterasi ke v0" }
  }
}

export async function iterateV0Chat(
  chatId: string,
  message: string,
  options?: CreateV0ChatOptions
): Promise<{ files: V0File[]; v0Error?: string }> {
  if (chatId.startsWith("sacms_gen_")) {
    const files = generateFallbackFiles(message, "v0-pro")
    return { files }
  }

  const resolvedKey = await resolveV0ApiKey(options?.apiKey)
  const client = getV0Client(resolvedKey)

  try {
    options?.onProgress?.("SaCMS Engine: Mengirim instruksi iterasi...")
    if (typeof (client.messages as any).sendAsync === "function") {
      await (client.messages as any).sendAsync({ chatId, message })
    } else {
      await client.messages.send({ chatId, message })
    }

    let files: V0File[] = []
    const startTime = Date.now()
    const maxWaitSeconds = options?.maxWaitSeconds || 30
    const pollInterval = options?.pollIntervalMs || 2500

    while (Date.now() - startTime < maxWaitSeconds * 1000) {
      try {
        const filesRes = await client.chats.getFiles({ chatId })
        const rawFiles =
          (filesRes as any)?.data?.files ||
          (filesRes as any)?.files ||
          (filesRes as any)?.data ||
          []
        if (Array.isArray(rawFiles) && rawFiles.length > 0) {
          files = rawFiles.map((f: any) => {
            const rawName = f.path ?? f.name ?? "app/page.tsx"
            const name = rawName.replace(/^\//, "")
            let content = f.content ?? ""
            if (f.encoding === "base64" && content) {
              try {
                content = Buffer.from(content, "base64").toString("utf-8")
              } catch {}
            }
            return { name, content }
          })
          break
        }
      } catch {}
      await new Promise((r) => setTimeout(r, pollInterval))
    }

    return { files }
  } catch (error: any) {
    console.warn("[v0-client] iterateV0Chat fallback:", error?.message)
    const files = generateFallbackFiles(message, "v0-pro")
    return { files, v0Error: error?.message }
  }
}

export async function deleteV0Chat(chatId: string, clientInstance?: any): Promise<boolean> {
  if (chatId.startsWith("sacms_gen_")) return true
  const client = clientInstance || getV0Client()
  try {
    if (typeof (client.chats as any).delete === "function") {
      await (client.chats as any).delete({ chatId })
      return true
    }
    return false
  } catch (error) {
    console.error("Failed to delete v0 chat:", error)
    return false
  }
}

export async function getV0ChatMessages(chatId: string, clientInstance?: any): Promise<any[]> {
  if (chatId.startsWith("sacms_gen_")) {
    return [
      {
        id: "msg_1",
        role: "assistant",
        content: "Website Next.js 16 berhasil di-generate secara instan menggunakan SaCMS Engine.",
        createdAt: new Date().toISOString(),
      },
    ]
  }
  const client = clientInstance || getV0Client()
  try {
    const res = await client.messages.list({ chatId, limit: 50 })
    return (res as any)?.data?.messages || (res as any)?.messages || (res as any)?.data || []
  } catch (error) {
    console.error("Failed to get v0 messages:", error)
    return []
  }
}
