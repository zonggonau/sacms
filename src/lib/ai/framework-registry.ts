/**
 * SaCMS AI Website Builder — Framework Registry
 *
 * Supported frontend frameworks for autonomous website generation,
 * with full Vercel server & hosting compatibility metadata.
 */

export type FrameworkId = "nextjs" | "vite" | "astro" | "remix" | "vue" | "svelte"

export interface FrameworkConfig {
  id: FrameworkId
  name: string
  shortName: string
  icon: string
  tagline: string
  description: string
  vercelSupport: "Native" | "Static" | "Serverless" | "Edge"
  category: "Full-Stack" | "SPA" | "Content/Static"
  badge: string
  isDefault?: boolean
  recommendedFor: string[]
  mainEntryFile: string
  apiClientPath: string
  typesPath: string
  buildOutputDirectory: string
  sampleKeywords: string[]
}

export const FRAMEWORK_REGISTRY: FrameworkConfig[] = [
  {
    id: "nextjs",
    name: "Next.js 16 (App Router)",
    shortName: "Next.js",
    icon: "▲",
    tagline: "React Server Components, SSR/ISR & API Routes",
    description: "Framework unggulan Vercel. Paling optimal untuk website dinamis, portal berita, multi-halaman SEO tinggi, dan aplikasi full-stack terintegrasi SaCMS.",
    vercelSupport: "Native",
    category: "Full-Stack",
    badge: "Rekomendasi Utama",
    isDefault: true,
    recommendedFor: ["E-Commerce", "Portal Berita / OPD", "SaaS", "Website Multi-Halaman", "SEO Tinggi"],
    mainEntryFile: "app/page.tsx",
    apiClientPath: "lib/sacms.ts",
    typesPath: "types/cms.ts",
    buildOutputDirectory: ".next",
    sampleKeywords: ["ecommerce", "toko", "portal", "dinas", "pemerintah", "berita", "multi-page", "ssr", "seo"],
  },
  {
    id: "vite",
    name: "Vite 6 + React 19 (SPA)",
    shortName: "Vite React",
    icon: "⚡",
    tagline: "Ultra-fast Client-Side Single Page Application",
    description: "Super ringan & instan. Sangat cocok untuk dashboard interaktif, katalog portofolio, kalkulator/tools online, dan landing page modern tanpa build delay.",
    vercelSupport: "Static",
    category: "SPA",
    badge: "Ultra Ringan & Cepat",
    recommendedFor: ["Dashboard Interaktif", "Portofolio / CV", "Katalog Produk Ringan", "Landing Page SPA", "Web Tools"],
    mainEntryFile: "src/App.tsx",
    apiClientPath: "src/lib/sacms.ts",
    typesPath: "src/types/cms.ts",
    buildOutputDirectory: "dist",
    sampleKeywords: ["spa", "single page", "dashboard", "portofolio", "portfolio", "cepat", "ringan", "tools", "kalkulator"],
  },
  {
    id: "astro",
    name: "Astro 5 (Content & Islands)",
    shortName: "Astro",
    icon: "🚀",
    tagline: "Zero-JS Islands Architecture & 100 Lighthouse Score",
    description: "Framework berkinerja tinggi untuk website berbasis konten, blog, panduan wisata, dokumentasi, dan company profile dengan skor Lighthouse maksimal.",
    vercelSupport: "Static",
    category: "Content/Static",
    badge: "Lighthouse 100",
    recommendedFor: ["Blog & Publikasi", "Wisata & Kuliner", "Profil Perusahaan", "Dokumentasi", "Landing Page Berkecepatan Ekstrem"],
    mainEntryFile: "src/pages/index.astro",
    apiClientPath: "src/lib/sacms.ts",
    typesPath: "src/types/cms.ts",
    buildOutputDirectory: "dist",
    sampleKeywords: ["blog", "wisata", "kuliner", "artikel", "statis", "dokumentasi", "docs", "lighthouse", "performa"],
  },
  {
    id: "remix",
    name: "Remix / React Router v7",
    shortName: "Remix",
    icon: "💿",
    tagline: "Nested Routing, Progressive Enhancement & Server Loaders",
    description: "Framework full-stack dengan model data mutasi bawaan (Action & Loader). Sangat cocok untuk formulir kompleks, pendaftaran online, dan workflow interaktif.",
    vercelSupport: "Serverless",
    category: "Full-Stack",
    badge: "Form & Data Mutasi",
    recommendedFor: ["Sistem Reservasi / Booking", "Pendaftaran & Antrean", "Formulir Multi-Step", "Portal Layanan Publik"],
    mainEntryFile: "app/routes/_index.tsx",
    apiClientPath: "app/lib/sacms.ts",
    typesPath: "app/types/cms.ts",
    buildOutputDirectory: "build",
    sampleKeywords: ["booking", "reservasi", "pendaftaran", "antrean", "mutasi", "form", "formulir", "nested"],
  },
  {
    id: "vue",
    name: "Vue 3 + Vite",
    shortName: "Vue 3",
    icon: "💚",
    tagline: "Composition API, Pinia State & Single File Components",
    description: "Pilihan ideal bagi pengembang dan pengguna ekosistem Vue. Clean reactivity, template syntax yang intuitif, serta terhubung mulus ke SaCMS REST API.",
    vercelSupport: "Static",
    category: "SPA",
    badge: "Ekosistem Vue",
    recommendedFor: ["Aplikasi Web Vue", "Katalog Interaktif", "Landing Page Modern", "Internal Tools"],
    mainEntryFile: "src/App.vue",
    apiClientPath: "src/lib/sacms.ts",
    typesPath: "src/types/cms.ts",
    buildOutputDirectory: "dist",
    sampleKeywords: ["vue", "vue3", "pinia", "sfc"],
  },
  {
    id: "svelte",
    name: "SvelteKit 2",
    shortName: "SvelteKit",
    icon: "🧡",
    tagline: "Compiler-based Reactivity & Zero Virtual DOM Overhead",
    description: "Tanpa overhead virtual DOM, ukuran bundle ekstra kecil, dan reaktivitas murni. Kompatibel dengan Vercel adapter untuk deployment instan.",
    vercelSupport: "Serverless",
    category: "Full-Stack",
    badge: "Zero Virtual DOM",
    recommendedFor: ["Aplikasi Web Responsif Ekstrem", "Website Ringan Interaktif", "Mobile-first PWA"],
    mainEntryFile: "src/routes/+page.svelte",
    apiClientPath: "src/lib/sacms.ts",
    typesPath: "src/types/cms.ts",
    buildOutputDirectory: ".svelte-kit",
    sampleKeywords: ["svelte", "sveltekit", "compiler", "lean"],
  },
]

/**
 * Get configuration for a specific framework ID
 */
export function getFrameworkConfig(id?: string | null): FrameworkConfig {
  if (!id) return FRAMEWORK_REGISTRY[0]
  return FRAMEWORK_REGISTRY.find((f) => f.id === id) || FRAMEWORK_REGISTRY[0]
}

/**
 * Intelligently detect or recommend the best framework based on the user's prompt text
 */
export function detectOrRecommendFramework(prompt: string): {
  recommendedId: FrameworkId
  reason: string
  confidence: "high" | "medium" | "default"
} {
  const lower = (prompt || "").toLowerCase()

  // Explicit framework requests from prompt
  if (lower.includes("nextjs") || lower.includes("next.js") || lower.includes("app router")) {
    return {
      recommendedId: "nextjs",
      reason: "Diminta secara spesifik dalam prompt (Next.js 16 App Router).",
      confidence: "high",
    }
  }
  if (lower.includes("vite") || lower.includes("spa") || lower.includes("single page app")) {
    return {
      recommendedId: "vite",
      reason: "Diminta secara spesifik dalam prompt (Vite + React SPA).",
      confidence: "high",
    }
  }
  if (lower.includes("astro")) {
    return {
      recommendedId: "astro",
      reason: "Diminta secara spesifik dalam prompt (Astro 5 Islands).",
      confidence: "high",
    }
  }
  if (lower.includes("remix") || lower.includes("react router")) {
    return {
      recommendedId: "remix",
      reason: "Diminta secara spesifik dalam prompt (Remix).",
      confidence: "high",
    }
  }
  if (lower.includes("vue") || lower.includes("vue3")) {
    return {
      recommendedId: "vue",
      reason: "Diminta secara spesifik dalam prompt (Vue 3).",
      confidence: "high",
    }
  }
  if (lower.includes("svelte") || lower.includes("sveltekit")) {
    return {
      recommendedId: "svelte",
      reason: "Diminta secara spesifik dalam prompt (SvelteKit).",
      confidence: "high",
    }
  }

  // Domain archetype keyword scoring
  let highestScore = 0
  let bestMatch: FrameworkConfig = FRAMEWORK_REGISTRY[0]

  for (const fw of FRAMEWORK_REGISTRY) {
    let score = 0
    for (const kw of fw.sampleKeywords) {
      if (lower.includes(kw)) score += 2
    }
    for (const rec of fw.recommendedFor) {
      if (lower.includes(rec.toLowerCase())) score += 3
    }
    if (score > highestScore) {
      highestScore = score
      bestMatch = fw
    }
  }

  if (highestScore >= 3) {
    return {
      recommendedId: bestMatch.id,
      reason: `Direkomendasikan untuk kebutuhan ${bestMatch.recommendedFor.slice(0, 2).join(" & ")}.`,
      confidence: "medium",
    }
  }

  // Default to Next.js 16 as the flagship full-stack framework
  return {
    recommendedId: "nextjs",
    reason: "Standar industri full-stack modern dengan dukungan Vercel native & React Server Components.",
    confidence: "default",
  }
}
