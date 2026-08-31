import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"
import { getLandingData } from "@/lib/public-api"

// ISR: Rebuild sitemap every hour
export const revalidate = 3600

function parseDateSafely(val: any, fallback: Date): Date {
  if (!val) return fallback
  const d = new Date(val)
  if (isNaN(d.getTime())) {
    return fallback
  }
  return d
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()

  // Base static routes
  const routes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/docs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
  ]

  try {
    const data = await getLandingData()
    const blogs = data.blogs || []

    for (const blog of blogs) {
      const slug = blog.slug || blog.id || blog.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
      if (slug) {
        routes.push({
          url: `${baseUrl}/blog/${slug}`,
          lastModified: parseDateSafely(blog.date, now),
          changeFrequency: "weekly",
          priority: 0.7,
        })
      }
    }
  } catch (e) {
    console.error("Error generating sitemap:", e)
  }

  return routes
}

