import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { getLandingData } from "@/lib/public-api"
import { BlogExplorer, type BlogPost } from "@/components/blog/blog-explorer"
import { Sparkles } from "lucide-react"
import { getSiteUrl, SEO_CONFIG } from "@/lib/seo"

// ISR: Blog list rebuilds every 30 minutes. getLandingData() queries DB directly.
export const revalidate = 1800

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = getSiteUrl()
  const blogUrl = `${siteUrl}/blog`
  const title = "Blog & Wawasan Arsitektur Headless CMS — SaCMS"
  const description =
    "Eksplorasi wawasan teknis, arsitektur hybrid multi-tenancy, tutorial Next.js 16 App Router, Dynamic GraphQL, dan strategi optimasi sistem Headless CMS bersama SaCMS."

  return {
    title,
    description,
    keywords: [
      "SaCMS Blog",
      "Headless CMS Architecture",
      "Multi-Tenant PostgreSQL 17",
      "Next.js 16 Tutorial",
      "Dynamic GraphQL",
      "Upstash Redis Edge Cache",
      "Model Context Protocol",
      "Web Engineering Insights"
    ],
    alternates: {
      canonical: blogUrl,
    },
    openGraph: {
      title,
      description,
      url: blogUrl,
      siteName: "SaCMS — Smart Content Management System",
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: `${siteUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: "SaCMS Blog & Insights",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/og-image.png`],
      creator: SEO_CONFIG.social.twitter,
    },
  }
}

export default async function BlogPage() {
  const data = await getLandingData()
  const blogs: BlogPost[] = data.blogs || []
  const siteUrl = getSiteUrl()

  const blogCollectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/blog`,
    "name": "Blog & Wawasan Arsitektur Headless CMS — SaCMS",
    "description": "Kumpulan artikel dan panduan teknis seputar arsitektur Headless CMS, multi-tenancy, dan web engineering modern.",
    "url": `${siteUrl}/blog`,
    "publisher": {
      "@type": "Organization",
      "name": "SaCMS — Smart Content Management System",
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/logo.svg`
      }
    },
    "hasPart": blogs.map((b) => {
      const slug = b.slug || b.id || b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      return {
        "@type": "BlogPosting",
        "headline": b.title,
        "url": `${siteUrl}/blog/${slug}`,
        "description": b.excerpt,
        "datePublished": b.date
      }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogCollectionJsonLd) }}
      />

      <LandingHeader brandName={data.footer?.brand_name} />

      <main className="flex-1 pt-28 sm:pt-32 pb-20 relative overflow-hidden">
        {/* Abstract Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[500px] opacity-30 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent blur-3xl rounded-full mix-blend-screen" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 max-w-7xl relative z-10 space-y-12">
          {/* Hero Header */}
          <div className="text-center space-y-4 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold tracking-wide uppercase backdrop-blur-md shadow-xs">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>SaCMS Insights & Wawasan Arsitektur</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-foreground">
              Wawasan & Berita <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-500">Smart CMS</span>
            </h1>

            <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-medium leading-relaxed">
              Temukan panduan praktis, analisis arsitektur multi-tenant, dan strategi pengiriman konten digital kelas dunia bersama <strong>SaCMS</strong>.
            </p>
          </div>

          {/* Interactive Explorer (Search + Category Filter + Featured Spotlight + Grid) */}
          <BlogExplorer initialPosts={blogs} />
        </div>
      </main>

      <FooterSection footer={data.footer} />
    </div>
  )
}
