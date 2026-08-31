import type { Metadata } from "next"
import { DocsClient } from "./docs-client"
import { getSiteUrl, SEO_CONFIG, generateDocsJsonLd } from "@/lib/seo"

const siteUrl = getSiteUrl()
const docsUrl = `${siteUrl}/docs`

export const metadata: Metadata = {
  title: "API & Model Context Protocol (MCP) Documentation — SaCMS",
  description:
    "Dokumentasi lengkap REST API, Dynamic GraphQL, TypeScript SDK, dan Model Context Protocol (MCP) Server untuk Cursor, Claude, Windsurf, VS Code, dan AI Agents.",
  keywords: [
    "SaCMS Documentation",
    "Headless CMS API",
    "Model Context Protocol",
    "MCP Server",
    "Dynamic GraphQL",
    "REST API Strapi Alternative",
    "Next.js 16 App Router CMS",
    "Multi-Tenant API"
  ],
  alternates: {
    canonical: docsUrl,
  },
  openGraph: {
    title: "API & Model Context Protocol (MCP) Documentation — SaCMS",
    description:
      "Dokumentasi lengkap REST API, Dynamic GraphQL, TypeScript SDK, dan MCP Server untuk integrasi AI coding assistants dan frontend modern.",
    url: docsUrl,
    siteName: "SaCMS — Smart Content Management System",
    type: "article",
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "SaCMS API & MCP Documentation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "API & Model Context Protocol (MCP) Documentation — SaCMS",
    description:
      "Dokumentasi lengkap REST API, Dynamic GraphQL, TypeScript SDK, dan MCP Server untuk AI coding assistant.",
    images: [`${siteUrl}/og-image.png`],
    creator: SEO_CONFIG.social.twitter,
  },
}

export default function DocsPage() {
  const docsJsonLd = generateDocsJsonLd()

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(docsJsonLd) }}
      />
      <DocsClient />
    </>
  )
}
