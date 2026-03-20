import { db } from "@/lib/database"
import { LandingHeader } from "@/components/landing/header"
import { Badge } from "@/components/ui/badge"
import { Database, ArrowRight, Calendar, User } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

async function getAllPosts() {
  const tenant = await db.tenant.findFirst()
  if (!tenant) return []

  const entries = await db.contentEntry.findMany({
    where: {
      tenantId: tenant.id,
      status: "PUBLISHED",
      contentType: { slug: "startup-blog" }
    },
    include: {
      contentType: true
    },
    orderBy: { createdAt: "desc" }
  })

  return entries.map(e => ({
    ...e,
    data: typeof e.data === 'string' ? JSON.parse(e.data) : e.data
  }))
}

export default async function BlogIndexPage() {
  const posts = await getAllPosts()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />

      <main className="flex-1 container py-12 md:py-24">
        {/* Header */}
        <div className="max-w-2xl mb-16">
          <Badge variant="secondary" className="mb-4 bg-emerald-50 text-emerald-700 border-emerald-100 uppercase tracking-widest text-[10px] font-black">
            Our Journal
          </Badge>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            Insights from the <br />
            <span className="bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
              Startup Ecosystem
            </span>
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Latest news, tutorials, and success stories from the founders building on ContentFlow.
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed rounded-3xl opacity-50">
            <Database className="h-12 w-12 mx-auto mb-4" />
            <p className="font-bold">No articles published yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {posts.map((post) => {
              const { title, excerpt, author, slug, featured_image } = post.data
              return (
                <Link key={post.id} href={`/blog/${slug}`} className="group flex flex-col h-full">
                  <div className="aspect-video rounded-2xl bg-muted mb-6 overflow-hidden relative">
                    {featured_image ? (
                      <img 
                        src={typeof featured_image === 'string' ? featured_image : (featured_image as any).url} 
                        alt={title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 to-teal-500/10 flex items-center justify-center">
                        <Database className="w-10 h-10 text-emerald-500/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {format(new Date(post.createdAt), 'MMM dd, yyyy')}</span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {author || 'Admin'}</span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3 group-hover:text-primary transition-colors leading-snug">
                      {title}
                    </h3>
                    <p className="text-muted-foreground text-sm line-clamp-3 mb-6 leading-relaxed">
                      {excerpt}
                    </p>
                    <div className="mt-auto flex items-center text-sm font-bold text-primary">
                      Read Full Article <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>

      <footer className="border-t py-12">
        <div className="container text-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} ContentFlow. Built with passion for founders.
          </p>
        </div>
      </footer>
    </div>
  )
}
