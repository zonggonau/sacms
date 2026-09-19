import type { MetadataRoute } from "next"
import { getSiteUrl } from "@/lib/seo"

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl()

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs", "/docs/*", "/blog", "/blog/*", "/login", "/register"],
        disallow: [
          "/api/admin/",
          "/api/tenant/",
          "/dashboard/",
          "/dashboard/*",
          "/(system)/",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
