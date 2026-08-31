/**
 * SaCMS — SEO, Metadata & JSON-LD Structured Data Utilities
 * Brand: SaCMS (Smart Content Management System)
 * Motto: Build smarter. Manage easier. Scale faster.
 */

export function getSiteUrl(): string {
  const envUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!envUrl) return "https://sacms.cloud"
  if (envUrl.startsWith("http://") || envUrl.startsWith("https://")) return envUrl.replace(/\/$/, "")
  return `https://${envUrl.replace(/\/$/, "")}`
}

export const SEO_CONFIG = {
  brandName: "SaCMS",
  brandDetail: "Smart Content Management System",
  slogan: "Build smarter. Manage easier. Scale faster.",
  defaultTitle: "SaCMS — Smart Content Management System | Build smarter. Manage easier. Scale faster.",
  defaultDescription: "SaCMS (Smart Content Management System) — Platform Headless CMS multi-tenant modern dengan Dedicated PostgreSQL 17 Appliance, 1-Prompt AI Fullstack Website Engine, Vercel-Style Custom DNS, Dynamic GraphQL, dan Billing Midtrans otomatis.",
  keywords: [
    "SaCMS",
    "Smart Content Management System",
    "Headless CMS",
    "Multi-Tenant Headless CMS",
    "PostgreSQL 17 Appliance",
    "Dedicated VPS CMS",
    "AI Website Builder",
    "Next.js 16 CMS",
    "Dynamic GraphQL",
    "Model Context Protocol",
    "MCP Server",
    "Strapi Alternative",
    "Vercel Custom DNS",
    "Midtrans Billing CMS",
    "Cloudflare R2 Media",
    "SaaS Headless CMS"
  ],
  social: {
    twitter: "@sacms_cloud",
  }
}

/**
 * Generate JSON-LD for Organization & SoftwareApplication
 */
export function generatePlatformJsonLd() {
  const baseUrl = getSiteUrl()

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${baseUrl}/#organization`,
        "name": "SaCMS — Smart Content Management System",
        "url": baseUrl,
        "logo": {
          "@type": "ImageObject",
          "@id": `${baseUrl}/#logo`,
          "url": `${baseUrl}/logo.svg`,
          "caption": "SaCMS Logo"
        },
        "description": SEO_CONFIG.defaultDescription,
        "slogan": SEO_CONFIG.slogan,
        "contactPoint": {
          "@type": "ContactPoint",
          "telephone": "+62-821-9922-0551",
          "contactType": "customer service",
          "areaServed": "ID",
          "availableLanguage": ["Indonesian", "English"]
        }
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${baseUrl}/#software`,
        "name": "SaCMS",
        "alternateName": "Smart Content Management System",
        "applicationCategory": "BusinessApplication, DeveloperApplication",
        "operatingSystem": "Cloud, Linux, Docker",
        "url": baseUrl,
        "description": SEO_CONFIG.defaultDescription,
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "IDR",
          "description": "Free Starter Tier & Dedicated Appliance Enterprise"
        },
        "featureList": [
          "Hybrid Multi-Tenancy & Dedicated PostgreSQL 17 Appliance",
          "1-Prompt AI Fullstack Next.js Website Engine",
          "Dynamic GraphQL Schema & Strapi-Style REST API",
          "Model Context Protocol (MCP) Bridge for AI Coding Assistants",
          "Vercel-Style Custom Domain DNS Auto-Verification",
          "Automated QRIS & Virtual Account Billing via Midtrans",
          "7-Stage Content Workflow with Granular RBAC Permissions",
          "Cloudflare R2 / S3 Object Storage with 0 Egress Fee"
        ],
        "author": {
          "@id": `${baseUrl}/#organization`
        }
      }
    ]
  }
}

/**
 * Generate JSON-LD for FAQs
 */
export function generateFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  if (!faqs || faqs.length === 0) return null

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer.replace(/<[^>]*>/g, "")
      }
    }))
  }
}

/**
 * Generate JSON-LD for BlogPosting
 */
export function generateBlogPostJsonLd(post: {
  title: string
  slug: string
  excerpt?: string
  content?: string
  date?: string
  author?: string
  authorAvatar?: string
  coverImage?: string
  category?: string
}) {
  const baseUrl = getSiteUrl()
  const postUrl = `${baseUrl}/blog/${post.slug}`

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": postUrl,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl
    },
    "headline": post.title,
    "description": post.excerpt || post.title,
    "image": post.coverImage ? [post.coverImage] : [`${baseUrl}/og-image.png`],
    "datePublished": post.date || new Date().toISOString(),
    "dateModified": post.date || new Date().toISOString(),
    "articleSection": post.category || "Technology",
    "author": {
      "@type": "Person",
      "name": post.author || "Tim SaCMS"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SaCMS — Smart Content Management System",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.svg`
      }
    }
  }
}

/**
 * Generate JSON-LD for Documentation / TechArticle
 */
export function generateDocsJsonLd() {
  const baseUrl = getSiteUrl()
  const docsUrl = `${baseUrl}/docs`

  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "@id": docsUrl,
    "headline": "SaCMS API & Model Context Protocol (MCP) Documentation",
    "description": "Comprehensive documentation for SaCMS REST API, Dynamic GraphQL, TypeScript SDK, and MCP Server for AI Coding Assistants.",
    "url": docsUrl,
    "author": {
      "@type": "Organization",
      "name": "SaCMS Engineering Team"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SaCMS — Smart Content Management System",
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo.svg`
      }
    }
  }
}
