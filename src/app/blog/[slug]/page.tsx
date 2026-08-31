import { notFound } from "next/navigation"
import Link from "next/link"
import type { Metadata } from "next"
import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { getLandingData } from "@/lib/public-api"
import { type BlogPost } from "@/components/blog/blog-explorer"
import { 
  Calendar, 
  Clock, 
  User, 
  ArrowLeft, 
  ChevronRight, 
  ArrowRight
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getSiteUrl, SEO_CONFIG, generateBlogPostJsonLd } from "@/lib/seo"

export const dynamic = "force-dynamic"

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params
  const data = await getLandingData()
  const blogs: BlogPost[] = data.blogs || []
  const siteUrl = getSiteUrl()
  const articleUrl = `${siteUrl}/blog/${slug}`
  
  const post = blogs.find(
    (b) => (b.slug || b.id || b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) === slug
  )

  if (!post) {
    return {
      title: "Artikel Tidak Ditemukan — SaCMS",
    }
  }

  const cleanDescription = post.excerpt || (post.content ? post.content.replace(/<[^>]*>/g, "").slice(0, 160) + "..." : "Baca artikel lengkap di SaCMS Blog.")
  const ogImages = post.cover_image 
    ? [{ url: post.cover_image, width: 1200, height: 630, alt: post.title }] 
    : [{ url: `${siteUrl}/og-image.png`, width: 1200, height: 630, alt: post.title }]

  return {
    title: `${post.title} — SaCMS Blog`,
    description: cleanDescription,
    keywords: [
      post.category || "Headless CMS",
      "SaCMS Blog",
      "Smart Content Management System",
      "Next.js 16",
      "PostgreSQL 17",
      "API Architecture"
    ],
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      title: post.title,
      description: cleanDescription,
      url: articleUrl,
      siteName: "SaCMS — Smart Content Management System",
      type: "article",
      locale: "id_ID",
      publishedTime: post.date,
      authors: [post.author || "Tim SaCMS"],
      section: post.category || "Technology",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: cleanDescription,
      images: post.cover_image ? [post.cover_image] : [`${siteUrl}/og-image.png`],
      creator: SEO_CONFIG.social.twitter,
    },
  }
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params
  const data = await getLandingData()
  const blogs: BlogPost[] = data.blogs || []
  const siteUrl = getSiteUrl()

  const post = blogs.find(
    (b) => (b.slug || b.id || b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")) === slug
  )

  if (!post) {
    notFound()
  }

  const articleJsonLd = generateBlogPostJsonLd({
    title: post.title,
    slug,
    excerpt: post.excerpt,
    content: post.content,
    date: post.date,
    author: post.author,
    authorAvatar: post.author_avatar,
    coverImage: post.cover_image,
    category: post.category,
  })

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Beranda",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": `${siteUrl}/blog`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": `${siteUrl}/blog/${slug}`
      }
    ]
  }

  const relatedPosts = blogs.filter((b) => b !== post).slice(0, 3)

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground selection:bg-primary/30">
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <LandingHeader brandName={data.footer?.brand_name} />

      <main className="flex-1 pt-28 sm:pt-32 pb-24 relative overflow-hidden">
        {/* Abstract Background Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[400px] opacity-25 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/30 via-transparent to-transparent blur-3xl rounded-full" />
        </div>

        <article className="container mx-auto px-4 sm:px-6 max-w-4xl relative z-10 space-y-10">
          {/* Breadcrumbs & Back Button */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link 
              href="/blog" 
              className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors bg-card/60 border border-border/60 px-3.5 py-1.5 rounded-xl hover:bg-card"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Blog</span>
            </Link>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              <Link href="/" className="hover:text-foreground">Beranda</Link>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              <Link href="/blog" className="hover:text-foreground">Blog</Link>
              <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
              <span className="text-primary font-semibold truncate max-w-[200px]">{post.title}</span>
            </div>
          </div>

          {/* Article Header */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              {post.category && (
                <Badge className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold px-3 py-1 text-xs">
                  {post.category}
                </Badge>
              )}
              {post.date && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  {post.date}
                </span>
              )}
              {post.read_time && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                  <Clock className="w-3.5 h-3.5" />
                  {post.read_time}
                </span>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight text-foreground">
              {post.title}
            </h1>

            {/* Author Meta */}
            <div className="flex items-center justify-between pt-4 pb-2 border-y border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-primary/10 overflow-hidden border border-border/80 flex items-center justify-center shrink-0">
                  {post.author_avatar ? (
                    <img src={post.author_avatar} alt={post.author || "Author"} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{post.author || "Tim SaCMS"}</p>
                  <p className="text-xs text-muted-foreground font-medium">Platform Engineering & Cloud Architecture</p>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Image Banner */}
          {post.cover_image && (
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-border/80 bg-muted max-h-[500px]">
              <img
                src={post.cover_image}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Article Rich Content Body */}
          <div className="bg-card/40 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-12 shadow-xl">
            {post.content ? (
              <div 
                className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-black prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-p:leading-relaxed prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:font-mono prose-code:text-xs"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <div className="text-muted-foreground leading-relaxed space-y-4">
                <p className="text-base sm:text-lg font-medium leading-relaxed">
                  {post.excerpt}
                </p>
              </div>
            )}
          </div>

          {/* Related Articles Section */}
          {relatedPosts.length > 0 && (
            <div className="pt-12 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold tracking-tight">Artikel Terkait</h3>
                <Link href="/blog" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
                  Lihat Semua <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {relatedPosts.map((rPost, idx) => {
                  const rSlug = rPost.slug || rPost.id || rPost.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                  return (
                    <Link
                      key={rSlug || idx}
                      href={`/blog/${rSlug}`}
                      className="group bg-card/60 hover:bg-card/90 border border-border/60 hover:border-primary/50 rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        {rPost.category && (
                          <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/20 bg-primary/5">
                            {rPost.category}
                          </Badge>
                        )}
                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {rPost.title}
                        </h4>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                        <span>{rPost.date}</span>
                        <span className="text-primary font-semibold flex items-center gap-1">
                          Baca <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </article>
      </main>

      <FooterSection footer={data.footer} />
    </div>
  )
}
