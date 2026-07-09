import { LandingHeader } from "@/components/landing/header"
import { FooterSection } from "@/components/landing/sections/footer-section"
import { getLandingData } from "@/lib/public-api"
import { FadeIn } from "@/components/ui/fade-in"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Calendar, User } from "lucide-react"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Blog — SaCMS",
  description: "Berita dan update terbaru dari SaCMS.",
}

export default async function BlogPage() {
  const data = await getLandingData()
  const blogs = data.blogs || []

  return (
    <div className="flex flex-col min-h-screen bg-card text-foreground selection:bg-primary/30">
      <LandingHeader brandName={data.footer?.brand_name} />
      
      <main className="flex-1 pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-16 space-y-4">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">Berita & Update Terbaru</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Ikuti perkembangan terbaru, tips, dan wawasan seputar transformasi digital dengan SaCMS.
            </p>
          </div>

          {blogs.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p>Belum ada artikel yang dipublikasikan.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {blogs.map((blog: any, idx: number) => (
                <FadeIn key={idx} delay={100 + (idx * 50)}>
                  <Card className="h-full flex flex-col hover:border-primary/50 transition-colors overflow-hidden">
                    {blog.cover_image && (
                      <div className="w-full h-48 overflow-hidden bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={blog.cover_image} 
                          alt={blog.title} 
                          className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                        />
                      </div>
                    )}
                    <CardHeader className="pt-5 pb-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                        {blog.date && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {blog.date}
                          </div>
                        )}
                        {blog.category && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {blog.category}
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-xl line-clamp-2 leading-tight">
                        {blog.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <CardDescription className="text-sm line-clamp-3 text-muted-foreground/80">
                        {(blog.excerpt || (blog.content ? blog.content.replace(/<[^>]+>/g, '') : ''))}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </main>

      <FooterSection footer={data.footer} />
    </div>
  )
}
