"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Search, 
  Calendar, 
  Clock, 
  User, 
  ArrowRight, 
  Sparkles, 
  Tag, 
  CheckCircle2, 
  Mail,
  Send,
  BookOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export interface BlogPost {
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
  is_featured?: boolean
}

interface BlogExplorerProps {
  initialPosts: BlogPost[]
}

export function BlogExplorer({ initialPosts }: BlogExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("Semua")
  const [newsletterEmail, setNewsletterEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>()
    initialPosts.forEach((post) => {
      if (post.category) set.add(post.category)
    })
    return ["Semua", ...Array.from(set)]
  }, [initialPosts])

  // Filter posts
  const filteredPosts = useMemo(() => {
    return initialPosts.filter((post) => {
      const matchesCategory =
        selectedCategory === "Semua" ||
        (post.category && post.category.toLowerCase() === selectedCategory.toLowerCase())

      const q = searchQuery.toLowerCase().trim()
      if (!q) return matchesCategory

      const matchesSearch =
        post.title.toLowerCase().includes(q) ||
        (post.excerpt && post.excerpt.toLowerCase().includes(q)) ||
        (post.content && post.content.toLowerCase().includes(q)) ||
        (post.category && post.category.toLowerCase().includes(q)) ||
        (post.author && post.author.toLowerCase().includes(q))

      return matchesCategory && matchesSearch
    })
  }, [initialPosts, selectedCategory, searchQuery])

  // Featured post is either explicitly marked or the very first post
  const featuredPost = useMemo(() => {
    if (searchQuery || selectedCategory !== "Semua") return null
    return initialPosts.find((p) => p.is_featured) || initialPosts[0] || null
  }, [initialPosts, searchQuery, selectedCategory])

  // Posts to render in grid
  const gridPosts = useMemo(() => {
    if (featuredPost && !searchQuery && selectedCategory === "Semua") {
      return filteredPosts.filter((p) => p.slug !== featuredPost.slug && p.title !== featuredPost.title)
    }
    return filteredPosts
  }, [filteredPosts, featuredPost, searchQuery, selectedCategory])

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newsletterEmail) return
    setSubscribed(true)
  }

  const getPostSlug = (post: BlogPost) => {
    return post.slug || post.id || post.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }

  return (
    <div className="space-y-16">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* Search & Filter Header Bar */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="bg-card/60 backdrop-blur-xl border border-border/60 rounded-3xl p-6 sm:p-8 shadow-xl shadow-primary/5 space-y-6">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari artikel, topik, atau kata kunci..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 pl-11 pr-4 bg-background/80 border-border/60 rounded-2xl text-sm font-medium focus-visible:ring-2 focus-visible:ring-primary shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground hover:text-foreground bg-muted px-2 py-0.5 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Menampilkan {filteredPosts.length} dari {initialPosts.length} artikel</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => {
            const active = selectedCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 shrink-0 flex items-center gap-2 cursor-pointer ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                    : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50"
                }`}
              >
                <span>{cat}</span>
                {cat !== "Semua" && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                    {initialPosts.filter((p) => p.category?.toLowerCase() === cat.toLowerCase()).length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Featured Post Spotlight */}
      {/* ───────────────────────────────────────────────────────────── */}
      {featuredPost && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative group"
        >
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-blue-500/20 to-primary/30 rounded-3xl blur-xl opacity-50 group-hover:opacity-100 transition duration-500" />
          
          <div className="relative bg-card/80 backdrop-blur-2xl border border-border/80 rounded-3xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 shadow-2xl">
            {/* Cover Image */}
            <div className="lg:col-span-7 relative h-72 lg:h-auto min-h-[320px] overflow-hidden bg-muted">
              {featuredPost.cover_image ? (
                <img
                  src={featuredPost.cover_image}
                  alt={featuredPost.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-blue-500/10">
                  <Sparkles className="w-16 h-16 text-primary/40 animate-pulse" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent lg:hidden" />
              <div className="absolute top-4 left-4">
                <Badge className="bg-primary/90 text-primary-foreground font-extrabold px-3 py-1 text-xs shadow-lg backdrop-blur-md gap-1.5">
                  <Sparkles className="w-3 h-3" /> Artikel Utama
                </Badge>
              </div>
            </div>

            {/* Content Details */}
            <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground font-semibold">
                  {featuredPost.category && (
                    <span className="text-primary font-bold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                      {featuredPost.category}
                    </span>
                  )}
                  {featuredPost.date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {featuredPost.date}
                    </span>
                  )}
                  {featuredPost.read_time && (
                    <span className="flex items-center gap-1 text-muted-foreground/80">
                      <Clock className="w-3.5 h-3.5" />
                      {featuredPost.read_time}
                    </span>
                  )}
                </div>

                <Link href={`/blog/${getPostSlug(featuredPost)}`}>
                  <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground group-hover:text-primary transition-colors leading-snug">
                    {featuredPost.title}
                  </h2>
                </Link>

                <p className="text-sm text-muted-foreground/90 font-medium leading-relaxed line-clamp-3">
                  {featuredPost.excerpt || (featuredPost.content ? featuredPost.content.replace(/<[^>]+>/g, "").slice(0, 180) + "..." : "")}
                </p>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 overflow-hidden border border-border/80 flex items-center justify-center shrink-0">
                    {featuredPost.author_avatar ? (
                      <img src={featuredPost.author_avatar} alt={featuredPost.author || "Author"} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{featuredPost.author || "Tim SaCMS"}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">Platform Engineering</p>
                  </div>
                </div>

                <Link href={`/blog/${getPostSlug(featuredPost)}`}>
                  <Button className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-5 shadow-lg shadow-primary/20 gap-2 group/btn">
                    <span>Baca Artikel</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Articles Grid */}
      {/* ───────────────────────────────────────────────────────────── */}
      {gridPosts.length === 0 ? (
        <div className="bg-card/40 border border-border/60 rounded-3xl p-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2">
            <Search className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="text-xl font-bold">Tidak ada artikel yang sesuai</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Coba ubah kata kunci pencarian Anda atau pilih kategori lain untuk melihat artikel yang tersedia.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSearchQuery("")
              setSelectedCategory("Semua")
            }}
            className="rounded-xl font-bold text-xs mt-2"
          >
            Reset Pencarian
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {gridPosts.map((post, idx) => {
              const slug = getPostSlug(post)
              return (
                <motion.article
                  key={slug || idx}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="group bg-card/60 hover:bg-card/90 backdrop-blur-xl border border-border/60 hover:border-primary/50 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-primary/10 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Thumbnail */}
                    <Link href={`/blog/${slug}`} className="block relative h-52 overflow-hidden bg-muted">
                      {post.cover_image ? (
                        <img
                          src={post.cover_image}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-blue-500/5">
                          <BookOpen className="w-12 h-12 text-primary/30" />
                        </div>
                      )}
                      {post.category && (
                        <div className="absolute top-3 left-3">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-md font-bold text-[11px] border border-border/50 shadow-sm">
                            {post.category}
                          </Badge>
                        </div>
                      )}
                    </Link>

                    {/* Body */}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
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
                        <h3 className="text-lg font-bold tracking-tight text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                          {post.title}
                        </h3>
                      </Link>

                      <p className="text-xs text-muted-foreground/80 font-medium leading-relaxed line-clamp-3">
                        {post.excerpt || (post.content ? post.content.replace(/<[^>]+>/g, "").slice(0, 140) + "..." : "")}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 pb-6 pt-4 border-t border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 overflow-hidden border border-border/60 flex items-center justify-center shrink-0">
                        {post.author_avatar ? (
                          <img src={post.author_avatar} alt={post.author || "Author"} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-3.5 h-3.5 text-primary" />
                        )}
                      </div>
                      <span className="text-xs font-semibold text-foreground/80 truncate max-w-[120px]">
                        {post.author || "Tim SaCMS"}
                      </span>
                    </div>

                    <Link href={`/blog/${slug}`}>
                      <span className="text-xs font-bold text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Baca <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </motion.article>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Newsletter Subscription Section */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden p-8 sm:p-12 border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-blue-500/10 text-center shadow-2xl">
        <div className="max-w-2xl mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold">
            <Mail className="w-3.5 h-3.5" />
            <span>SaCMS Newsletter</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Dapatkan Wawasan & Update Arsitektur Langsung di Inbox Anda
          </h2>

          <p className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed max-w-lg mx-auto">
            Bergabunglah dengan ribuan developer, CTO, dan digital agency untuk menerima artikel teknis, tips optimasi Next.js, dan pembaruan fitur SaCMS.
          </p>

          {subscribed ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-3 text-emerald-500 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>Terima kasih! Anda telah berhasil berlangganan newsletter kami.</span>
            </div>
          ) : (
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
              <Input
                type="email"
                placeholder="nama@email.com"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                required
                className="h-12 bg-background/90 border-border/80 rounded-2xl text-xs font-medium px-4 focus-visible:ring-primary shadow-inner"
              />
              <Button type="submit" className="w-full sm:w-auto h-12 px-6 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-lg shadow-primary/25 gap-2 shrink-0">
                <Send className="w-3.5 h-3.5" />
                <span>Berlangganan</span>
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
