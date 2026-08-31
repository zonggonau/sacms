"use client"

import Link from "next/link"
import { Calendar, Clock, ArrowRight, BookOpen, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/i18n/context"

export interface BlogPostItem {
  slug?: string
  id?: string
  title: string
  excerpt?: string
  content?: string
  category?: string
  date?: string
  author?: string
  author_avatar?: string
  cover_image?: string
  read_time?: string
}

export function BlogPreviewSection({ blogs = [] }: { blogs?: BlogPostItem[] }) {
  const { dict } = useLanguage()

  if (!blogs || blogs.length === 0) return null

  const displayBlogs = blogs.slice(0, 3)

  const getSlug = (post: BlogPostItem) => {
    return post.slug || post.id || post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }

  return (
    <section id="blog" className="py-24 sm:py-32 relative bg-background border-t border-border/50 overflow-hidden">
      {/* Abstract Background Effect */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] opacity-15 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-transparent blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="container px-6 max-w-6xl mx-auto relative z-10 space-y-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{dict.blog?.badge || "Blog & Wawasan Terkini"}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight leading-tight">
              {dict.blog?.title || "Wawasan Teknis & Arsitektur SaCMS"}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl font-medium leading-relaxed">
              {dict.blog?.subtitle || "Panduan praktis, arsitektur multi-tenant, dan strategi pengembangan headless CMS modern."}
            </p>
          </div>

          <Link href="/blog">
            <Button variant="outline" className="rounded-2xl border-border/60 hover:border-primary/50 font-bold text-xs h-11 px-5 gap-2 shadow-xs shrink-0">
              <span>{dict.blog?.viewAll || "Lihat Semua Artikel"}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {displayBlogs.map((post, i) => {
            const slug = getSlug(post)
            return (
              <article
                key={slug || i}
                className="group bg-card/40 hover:bg-card/90 backdrop-blur-xl border border-border/60 hover:border-primary/50 rounded-3xl overflow-hidden shadow-md hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <Link href={`/blog/${slug}`} className="block relative h-48 overflow-hidden bg-muted">
                    {post.cover_image ? (
                      <img
                        src={post.cover_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-blue-500/5">
                        <BookOpen className="w-10 h-10 text-primary/30" />
                      </div>
                    )}
                    {post.category && (
                      <div className="absolute top-3 left-3">
                        <Badge variant="secondary" className="bg-background/80 backdrop-blur-md font-bold text-[10px] border border-border/50 shadow-sm">
                          {post.category}
                        </Badge>
                      </div>
                    )}
                  </Link>

                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
                      {post.date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {post.date}
                        </span>
                      )}
                      {post.read_time && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.read_time}
                        </span>
                      )}
                    </div>

                    <Link href={`/blog/${slug}`} className="block">
                      <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                        {post.title}
                      </h3>
                    </Link>

                    <p className="text-xs text-muted-foreground/80 font-medium leading-relaxed line-clamp-3">
                      {post.excerpt || (post.content ? post.content.replace(/<[^>]+>/g, "").slice(0, 120) + "..." : "")}
                    </p>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-3 border-t border-border/40 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground/80">{post.author || "Tim SaCMS"}</span>
                  <Link href={`/blog/${slug}`}>
                    <span className="font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      {dict.blog?.readMore || "Baca"} <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
