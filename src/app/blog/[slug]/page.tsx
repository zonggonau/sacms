import { db } from "@/lib/database"
import { notFound } from "next/navigation"
import { LandingHeader } from "@/components/landing/header"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, User, Clock, Share2 } from "lucide-react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export const dynamic = "force-dynamic"

async function getPostData(slug: string) {
  const tenant = await db.tenant.findFirst()
  if (!tenant) return null

  // Find the entry where the data.slug matches the URL slug
  // Since 'data' is stored as a JSON string in Prisma for this project
  const entries = await db.contentEntry.findMany({
    where: {
      tenantId: tenant.id,
      status: "PUBLISHED",
      contentType: { slug: "startup-blog" }
    }
  })

  const post = entries.find(e => {
    const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
    return data.slug === slug
  })

  if (!post) return null

  return {
    ...post,
    data: typeof post.data === 'string' ? JSON.parse(post.data) : post.data
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostData(slug)

  if (!post) {
    notFound()
  }

  const { title, content, author, featured_image, excerpt } = post.data

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <LandingHeader />

      <main className="flex-1 container max-w-4xl py-12 md:py-20">
        {/* Back Button */}
        <Link href="/" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Link>

        {/* Article Header */}
        <div className="space-y-6 mb-12">
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase tracking-widest text-[10px] font-black">
            Startup Ecosystem
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
            {title}
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            {excerpt}
          </p>

          <div className="flex flex-wrap items-center gap-6 pt-4 border-y py-6 border-muted/50">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {author?.charAt(0) || 'A'}
              </div>
              <div>
                <p className="text-sm font-bold">{author || 'Administrator'}</p>
                <p className="text-xs text-muted-foreground">Author</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">{format(new Date(post.createdAt), 'MMMM dd, yyyy')}</p>
                <p className="text-xs text-muted-foreground">Published Date</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">5 min read</p>
                <p className="text-xs text-muted-foreground">Reading Time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Image */}
        {featured_image && (
          <div className="aspect-video rounded-3xl overflow-hidden mb-12 shadow-2xl">
            <img 
              src={typeof featured_image === 'string' ? featured_image : (featured_image as any).url} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <article className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-p:leading-relaxed prose-a:text-emerald-600">
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </article>

        {/* Footer Actions */}
        <div className="mt-16 pt-8 border-t flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-full">
              <Share2 className="w-4 h-4 mr-2" /> Share Article
            </Button>
          </div>
          <Link href="/register">
            <Button className="bg-primary font-bold rounded-xl">Start Building with ContentFlow</Button>
          </Link>
        </div>
      </main>

      <footer className="border-t py-10">
        <div className="container text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ContentFlow Blog. All rights reserved.
        </div>
      </footer>
    </div>
  )
}
