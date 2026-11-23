import type { Metadata } from "next"
import Link from "next/link"
import { Sparkles, LayoutTemplate } from "lucide-react"
import { db } from "@/lib/database"
import { getSiteUrl, SEO_CONFIG } from "@/lib/seo"
import { TemplatesInfinite } from "./templates-infinite"

const PAGE_SIZE = 21 // 3 columns x 7 rows

export const dynamic = "force-dynamic" // Query DB at request time, skip prerendering
export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const title = "Galeri Template — Website Siap Pakai | SaCMS"
  const description =
    "Semua Website Template siap pakai di SaCMS: pilih, lihat demonya langsung, lalu terapkan ke workspace Anda dalam sekali klik."

  return {
    title: { absolute: title },
    description,
    keywords: [...SEO_CONFIG.keywords, "Template Website CMS", "Galeri Template SaCMS"],
    alternates: { canonical: `${siteUrl}/templates` },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/templates`,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function TemplatesPage() {
  const rows = await db.websiteTemplate.findMany({
    where: { published: true },
    select: { id: true, name: true, slug: true, icon: true, description: true, demoUrl: true },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
  })
  const hasMore = rows.length > PAGE_SIZE
  const templates = rows.slice(0, PAGE_SIZE).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    icon: t.icon,
    description: t.description || "",
    demoUrl: t.demoUrl || null,
  }))

  return (
    <main className="flex-1 pt-24 pb-16">
      <section className="py-14 sm:py-20 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] h-[350px] bg-gradient-to-tr from-primary/20 via-blue-500/10 to-transparent blur-3xl rounded-full pointer-events-none opacity-60" />

        <div className="container px-4 sm:px-6 max-w-4xl mx-auto relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Galeri Template</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
            Semua Website Template SaCMS
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
            Pilih template, lihat demonya langsung, lalu terapkan ke workspace Anda dalam sekali klik — tidak perlu mulai dari nol.
          </p>
        </div>
      </section>

      <section className="container px-4 sm:px-6 max-w-6xl mx-auto">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
            <LayoutTemplate className="h-8 w-8 opacity-40" />
            <p className="text-sm font-semibold">Belum ada Website Template yang dipublikasikan.</p>
            <Link href="/register" className="text-xs font-bold text-primary underline underline-offset-2">
              Mulai dari schema kosong &rarr;
            </Link>
          </div>
        ) : (
          <TemplatesInfinite initialTemplates={templates} initialHasMore={hasMore} />
        )}
      </section>
    </main>
  )
}
