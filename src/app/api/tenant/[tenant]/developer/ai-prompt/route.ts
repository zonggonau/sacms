import { NextResponse } from "next/server"
import { getTenantDb } from "@/lib/database"
import { withStaffAuth } from "@/lib/api/route-helpers"

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/** Map a CMS field type to a TypeScript type string */
function fieldTypeToTs(type: string, required: boolean, isArray: boolean): string {
  const baseMap: Record<string, string> = {
    text: "string",
    textarea: "string",
    richText: "string",
    richtext: "string",
    email: "string",
    password: "string",
    uid: "string",
    slug: "string",
    number: "number",
    integer: "number",
    float: "number",
    decimal: "number",
    boolean: "boolean",
    date: "string",
    datetime: "string",
    time: "string",
    json: "Record<string, any>",
    media: "string",
    mediaMultiple: "string[]",
    relation: "string",
    component: "any",
    enumeration: "string",
    color: "string",
    url: "string",
  }
  let ts = baseMap[type] || "any"
  if (isArray) ts = `${ts}[]`
  if (!required) ts += " | null"
  return ts
}

/** Convert a slug like "my-blog-post" to PascalCase "MyBlogPost" */
function toPascalCase(slug: string): string {
  return slug
    .replace(/^sacms-/, "")
    .replace(/^sacms-component-/, "")
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
}

/** Parse options field (could be string or object) */
function parseOptions(options: any): Record<string, any> {
  if (!options) return {}
  if (typeof options === "string") {
    try { return JSON.parse(options) } catch { return {} }
  }
  return options
}

// ──────────────────────────────────────────────────────────
// Main Route Handler
// ──────────────────────────────────────────────────────────

/**
 * GET /api/tenant/[tenant]/developer/ai-prompt
 * Generates a comprehensive AI prompt for building a frontend
 * application based on this tenant's CMS schema.
 */
export const GET = withStaffAuth(async (request, context, { access }) => {
    const { tenant: tenantSlug } = await context.params
    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)
    const tenant = access.tenant
    const tokenPlaceholder = "<YOUR_API_TOKEN>"
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    const fullApiBaseUrl = `${baseUrl}/api/public/${tenantSlug}`

    // ─── Fetch all schema data ───
    const [contentTypes, singleTypes, components] = await Promise.all([
      tenantDb.contentType.findMany({
        where: {
          OR: [
            { tenantId },
            { tenants: { some: { tenantId, enabled: true } } }
          ]
        },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.singleType.findMany({
        where: {
          OR: [
            { tenantId },
            { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
          ]
        },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
      tenantDb.component.findMany({
        where: {
          OR: [
            { tenantId },
            { tenantId: null, tenants: { some: { tenantId, enabled: true } } }
          ]
        },
        include: { schemaFields: { orderBy: { order: "asc" } } },
      }),
    ])

    // ─── Fetch sample data (1 entry per Collection, all Single Type data) ───
    const sampleContentData: Record<string, any> = {}
    for (const ct of contentTypes) {
      try {
        const entry = await tenantDb.contentEntry.findFirst({
          where: { contentTypeId: ct.id, tenantId, status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
        })
        if (entry) {
          sampleContentData[ct.slug] = {
            id: entry.id,
            status: entry.status,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
            ...(typeof entry.data === "object" ? entry.data as any : {}),
          }
        }
      } catch { /* skip if no data */ }
    }

    const sampleSingleData: Record<string, any> = {}
    for (const st of singleTypes) {
      try {
        const assignment = await tenantDb.tenantSingleTypeAssignment.findFirst({
          where: { singleTypeId: st.id, tenantId },
        })
        if (assignment?.data) {
          sampleSingleData[st.slug] = typeof assignment.data === "object" ? assignment.data : {}
        }
      } catch { /* skip */ }
    }

    // ─── Build component slug → component map ───
    const componentMap = new Map(components.map(c => [c.slug, c]))

    // Collect used component slugs from schema fields
    const usedComponentSlugs = new Set<string>()
    for (const ct of contentTypes) {
      for (const f of ct.schemaFields) {
        const opts = parseOptions(f.options)
        if (f.type === "component" && opts.componentSlug) {
          usedComponentSlugs.add(opts.componentSlug)
        }
      }
    }
    for (const st of singleTypes) {
      for (const f of st.schemaFields) {
        const opts = parseOptions(f.options)
        if (f.type === "component" && opts.componentSlug) {
          usedComponentSlugs.add(opts.componentSlug)
        }
      }
    }

    // ──────────────────────────────────────────────────────
    // BUILD THE PROMPT
    // ──────────────────────────────────────────────────────
    const lines: string[] = []
    const ln = (s: string = "") => lines.push(s)

    ln(`---
name: sacms-frontend-developer
description: Integrates frontend applications with SaCMS headless CMS via REST API.
---
# AI Skill — SaCMS Frontend Developer for ${tenant.name}`)

    ln(`> This skill context was auto-generated by SaCMS on ${new Date().toISOString().split("T")[0]}.`)
    ln(`> Use this with any AI coding agent (Cursor, Gemini, ChatGPT, Claude) to build frontend apps with your CMS data.`)
    ln()

    // ─── 1. Project Configuration & Environment Setup ───
    ln(`## 1. Project Configuration & Environment Setup`)
    ln()
    ln(`When creating this frontend application, **automatically generate a \`.env.example\` and \`.env.local\` file** with the following pre-filled variables:`)
    ln()
    ln("```env")
    ln(`# SaCMS Environment Variables`)
    ln(`NEXT_PUBLIC_CMS_BASE_URL="${baseUrl}"`)
    ln(`NEXT_PUBLIC_CMS_TENANT="${tenantSlug}"`)
    ln(`NEXT_PUBLIC_CMS_WORKSPACE_ID="${tenantId}"`)
    ln(`NEXT_PUBLIC_CMS_API_KEY= # Insert your SaCMS API token manually here`)
    ln("```")
    ln()
    ln(`| Environment Variable | Pre-filled Value | Description |`)
    ln(`|----------------------|------------------|-------------|`)
    ln(`| \`NEXT_PUBLIC_CMS_BASE_URL\` | \`${baseUrl}\` | Base URL of the SaCMS instance |`)
    ln(`| \`NEXT_PUBLIC_CMS_TENANT\` | \`${tenantSlug}\` | Workspace / Tenant slug |`)
    ln(`| \`NEXT_PUBLIC_CMS_WORKSPACE_ID\` | \`${tenantId}\` | Unique Workspace ID |`)
    ln(`| \`NEXT_PUBLIC_CMS_API_KEY\` | *Manual Input Required* | Obtain from SaCMS Dashboard > Settings > API Keys |`)
    ln()
    ln(`### API Endpoints Overview`)
    ln(`- **REST Base URL**: \`${fullApiBaseUrl}\` (\`\${NEXT_PUBLIC_CMS_BASE_URL}/api/public/\${NEXT_PUBLIC_CMS_TENANT}\`)`)
    ln(`- **GraphQL Endpoint**: \`${fullApiBaseUrl}/graphql\``)
    ln(`- **Brand API**: \`${fullApiBaseUrl}/brand\` (no auth required)`)
    ln(`- **Authorization Header**: \`Authorization: Bearer \${NEXT_PUBLIC_CMS_API_KEY}\``)
    ln()

    // ─── 2. Schema Definition ───
    ln(`## 2. Schema Definition`)
    ln()

    // 2a. Collection Types
    if (contentTypes.length > 0) {
      ln(`### 2.1. Collection Types (Multiple Entries)`)
      ln(`These represent collections of data. Create **list pages** and **detail pages** for each.`)
      ln()

      for (const ct of contentTypes) {
        ln(`#### 📦 ${ct.name} (\`${ct.slug}\`)`)
        if (ct.description) ln(`*${ct.description}*`)
        ln()
        ln(`**REST Endpoints:**`)
        ln(`- List all: \`GET ${fullApiBaseUrl}/content/${ct.slug}\``)
        ln(`- Filtered: \`GET ${fullApiBaseUrl}/content/${ct.slug}?filters[field][$eq]=value\``)
        ln(`- Search: \`GET ${fullApiBaseUrl}/content/${ct.slug}?search=keyword\``)
        ln()
        ln(`**GraphQL Queries:**`)
        ln("```graphql")
        ln(`# List`)
        ln(`query { ${ct.slug.replace(/-/g, "_")}(page: 1, limit: 10) { data { id ${ct.schemaFields.filter(f => f.type !== "component").map(f => f.slug).join(" ")} } meta { total page pageSize pageCount } } }`)
        ln()
        ln(`# Detail by ID`)
        ln(`query { ${ct.slug.replace(/-/g, "_")}ById(id: "entry-id") { id ${ct.schemaFields.filter(f => f.type !== "component").map(f => f.slug).join(" ")} } }`)
        ln("```")
        ln()
        ln(`**Fields:**`)
        ln(`| Field | Slug | Type | Required |`)
        ln(`|-------|------|------|----------|`)
        for (const f of ct.schemaFields) {
          const opts = parseOptions(f.options)
          let extra = ""
          if (f.type === "component" && opts.componentSlug) {
            extra = ` → \`${opts.componentSlug}\`${opts.repeatable ? " (repeatable)" : ""}`
          }
          ln(`| ${f.name} | \`${f.slug}\` | ${f.type}${extra} | ${f.required ? "✅" : "—"} |`)
        }
        ln()
      }
    }

    // 2b. Single Types
    if (singleTypes.length > 0) {
      ln(`### 2.2. Single Types (Unique Content)`)
      ln(`These represent unique pages or global settings (e.g., Homepage, Landing Page, About Us).`)
      ln()

      for (const st of singleTypes) {
        ln(`#### 📄 ${st.name} (\`${st.slug}\`)`)
        if (st.description) ln(`*${st.description}*`)
        ln()
        ln(`**Endpoint:** \`GET ${fullApiBaseUrl}/single/${st.slug}\``)
        ln()
        ln(`**Fields:**`)
        ln(`| Field | Slug | Type | Required |`)
        ln(`|-------|------|------|----------|`)
        for (const f of st.schemaFields) {
          const opts = parseOptions(f.options)
          let extra = ""
          if (f.type === "component" && opts.componentSlug) {
            extra = ` → \`${opts.componentSlug}\`${opts.repeatable ? " (repeatable)" : ""}`
          }
          ln(`| ${f.name} | \`${f.slug}\` | ${f.type}${extra} | ${f.required ? "✅" : "—"} |`)
        }
        ln()
      }
    }

    // 2c. Components
    if (usedComponentSlugs.size > 0) {
      ln(`### 2.3. Components (Reusable Data Structures)`)
      ln(`Components are embedded inside Single Types or Collection Types. They define the shape of nested data.`)
      ln()

      for (const slug of usedComponentSlugs) {
        const comp = componentMap.get(slug)
        if (!comp) continue

        ln(`#### 🧩 ${comp.name} (\`${comp.slug}\`)`)
        if (comp.description) ln(`*${comp.description}*`)
        ln()
        ln(`| Field | Slug | Type | Required |`)
        ln(`|-------|------|------|----------|`)
        for (const f of comp.schemaFields) {
          ln(`| ${f.name} | \`${f.slug}\` | ${f.type} | ${f.required ? "✅" : "—"} |`)
        }
        ln()
      }
    }

    // ─── 3. TypeScript Interfaces ───
    ln(`## 3. TypeScript Interfaces (Auto-Generated)`)
    ln()
    ln(`Copy these into \`src/lib/types.ts\` in your frontend project:`)
    ln()
    ln("```typescript")

    // Component interfaces first (dependencies)
    for (const slug of usedComponentSlugs) {
      const comp = componentMap.get(slug)
      if (!comp) continue
      const typeName = toPascalCase(comp.slug)
      ln(`export interface ${typeName} {`)
      for (const f of comp.schemaFields) {
        const opts = parseOptions(f.options)
        const tsType = fieldTypeToTs(f.type, f.required, false)
        ln(`  ${f.slug}: ${tsType}`)
      }
      ln(`}`)
      ln()
    }

    // Content Type interfaces
    for (const ct of contentTypes) {
      const typeName = toPascalCase(ct.slug)
      ln(`export interface ${typeName} {`)
      ln(`  id: string`)
      ln(`  status: string`)
      ln(`  createdAt: string`)
      ln(`  updatedAt: string`)
      for (const f of ct.schemaFields) {
        const opts = parseOptions(f.options)
        if (f.type === "component" && opts.componentSlug) {
          const compTypeName = toPascalCase(opts.componentSlug)
          const tsType = opts.repeatable ? `${compTypeName}[]` : compTypeName
          ln(`  ${f.slug}: ${tsType}${f.required ? "" : " | null"}`)
        } else {
          ln(`  ${f.slug}: ${fieldTypeToTs(f.type, f.required, false)}`)
        }
      }
      ln(`}`)
      ln()
    }

    // Single Type interfaces
    for (const st of singleTypes) {
      const typeName = toPascalCase(st.slug)
      ln(`export interface ${typeName} {`)
      for (const f of st.schemaFields) {
        const opts = parseOptions(f.options)
        if (f.type === "component" && opts.componentSlug) {
          const compTypeName = toPascalCase(opts.componentSlug)
          const tsType = opts.repeatable ? `${compTypeName}[]` : compTypeName
          ln(`  ${f.slug}: ${tsType}${f.required ? "" : " | null"}`)
        } else {
          ln(`  ${f.slug}: ${fieldTypeToTs(f.type, f.required, false)}`)
        }
      }
      ln(`}`)
      ln()
    }

    // API response types
    ln(`export interface ApiCollectionResponse<T> {`)
    ln(`  data: T[]`)
    ln(`  meta: { total: number; page: number; pageSize: number; pageCount: number }`)
    ln(`}`)
    ln()
    ln(`export interface ApiSingleResponse<T> {`)
    ln(`  data: T`)
    ln(`}`)
    ln("```")
    ln()

    // ─── 4. API Client Blueprint ───
    ln(`## 4. API Client Blueprint`)
    ln()
    ln(`Copy this into \`src/lib/api.ts\`:`)
    ln()
    ln("```typescript")
    ln(`const API_BASE = "${fullApiBaseUrl}"`)
    ln(`const API_KEY = process.env.SACMS_API_KEY || "${tokenPlaceholder}"`)
    ln()
    ln(`const headers: HeadersInit = {`)
    ln(`  "Authorization": \`Bearer \${API_KEY}\`,`)
    ln(`  "Content-Type": "application/json",`)
    ln(`}`)
    ln()
    ln(`// Fetch a collection (list of entries)`)
    ln(`export async function getCollection<T>(`)
    ln(`  contentType: string,`)
    ln(`  params?: Record<string, string>`)
    ln(`): Promise<{ data: T[]; meta: any }> {`)
    ln(`  const searchParams = new URLSearchParams(params)`)
    ln(`  const url = \`\${API_BASE}/content/\${contentType}?\${searchParams}\``)
    ln(`  const res = await fetch(url, {`)
    ln(`    headers,`)
    ln(`    next: { revalidate: 60 }, // ISR: revalidate every 60 seconds`)
    ln(`  })`)
    ln(`  if (!res.ok) throw new Error(\`API Error: \${res.status}\`)`)
    ln(`  return res.json()`)
    ln(`}`)
    ln()
    ln(`// Fetch a single type`)
    ln(`export async function getSingleType<T>(slug: string): Promise<{ data: T }> {`)
    ln(`  const url = \`\${API_BASE}/single/\${slug}\``)
    ln(`  const res = await fetch(url, {`)
    ln(`    headers,`)
    ln(`    next: { revalidate: 60 },`)
    ln(`  })`)
    ln(`  if (!res.ok) throw new Error(\`API Error: \${res.status}\`)`)
    ln(`  return res.json()`)
    ln(`}`)
    ln()
    ln(`// Fetch brand/white-label info (no auth required)`)
    ln(`export async function getBrand() {`)
    ln(`  const res = await fetch(\`\${API_BASE}/brand\`, {`)
    ln(`    next: { revalidate: 300 },`)
    ln(`  })`)
    ln(`  if (!res.ok) return null`)
    ln(`  return res.json()`)
    ln(`}`)
    ln()
    ln(`// GraphQL query helper`)
    ln(`export async function graphql<T>(query: string, variables?: Record<string, any>): Promise<T> {`)
    ln(`  const res = await fetch(\`\${API_BASE}/graphql\`, {`)
    ln(`    method: "POST",`)
    ln(`    headers,`)
    ln(`    body: JSON.stringify({ query, variables }),`)
    ln(`    next: { revalidate: 60 },`)
    ln(`  })`)
    ln(`  if (!res.ok) throw new Error(\`GraphQL Error: \${res.status}\`)`)
    ln(`  const json = await res.json()`)
    ln(`  return json.data`)
    ln(`}`)
    ln("```")
    ln()

    // ─── 5. Query Parameters Reference ───
    ln(`## 5. Query Parameters Reference`)
    ln()
    ln(`All collection endpoints support these query parameters:`)
    ln()
    ln(`### Filtering (Strapi-style)`)
    ln("```")
    ln(`?filters[field][$eq]=value        — Equal`)
    ln(`?filters[field][$ne]=value        — Not equal`)
    ln(`?filters[field][$gt]=value        — Greater than`)
    ln(`?filters[field][$gte]=value       — Greater than or equal`)
    ln(`?filters[field][$lt]=value        — Less than`)
    ln(`?filters[field][$lte]=value       — Less than or equal`)
    ln(`?filters[field][$contains]=value  — Contains (case-insensitive)`)
    ln(`?filters[field][$startsWith]=val  — Starts with`)
    ln(`?filters[field][$in]=a,b,c        — In array`)
    ln(`?filters[field][$notIn]=a,b,c     — Not in array`)
    ln(`?filters[field][$null]=true       — Is null`)
    ln(`?filters[field][$notNull]=true    — Is not null`)
    ln("```")
    ln()
    ln(`### Sorting`)
    ln("```")
    ln(`?sort=createdAt:desc              — Sort by field (asc or desc)`)
    ln(`?sort=title:asc                   — Alphabetical`)
    ln("```")
    ln()
    ln(`### Pagination`)
    ln("```")
    ln(`?pagination[page]=1&pagination[pageSize]=25`)
    ln("```")
    ln()
    ln(`### Field Selection`)
    ln("```")
    ln(`?fields=title,slug,description    — Return only specified fields`)
    ln("```")
    ln()
    ln(`### Populate Relations`)
    ln("```")
    ln(`?populate=*                       — Expand all relations`)
    ln(`?populate=author,category         — Expand specific relations`)
    ln("```")
    ln()
    ln(`### Search`)
    ln("```")
    ln(`?search=keyword                   — Full-text search across text fields`)
    ln("```")
    ln()

    // ─── 6. Sample API Responses ───
    const hasSamples = Object.keys(sampleContentData).length > 0 || Object.keys(sampleSingleData).length > 0
    if (hasSamples) {
      ln(`## 6. Sample API Responses`)
      ln()
      ln(`These are real responses from your CMS. Use them to understand the data shape.`)
      ln()

      for (const [slug, data] of Object.entries(sampleContentData)) {
        const ct = contentTypes.find(c => c.slug === slug)
        ln(`### Collection: ${ct?.name || slug}`)
        ln(`\`GET ${fullApiBaseUrl}/content/${slug}\``)
        ln()
        ln("```json")
        ln(`// Single entry from the collection (actual data):`)
        ln(JSON.stringify(data, null, 2))
        ln("```")
        ln()
      }

      for (const [slug, data] of Object.entries(sampleSingleData)) {
        const st = singleTypes.find(s => s.slug === slug)
        ln(`### Single Type: ${st?.name || slug}`)
        ln(`\`GET ${fullApiBaseUrl}/single/${slug}\``)
        ln()
        ln("```json")
        ln(`// Response data (actual):`)
        // Truncate very large objects for readability
        const jsonStr = JSON.stringify(data, null, 2)
        if (jsonStr.length > 5000) {
          const truncated = jsonStr.substring(0, 5000)
          ln(truncated)
          ln(`// ... truncated (${jsonStr.length} chars total)`)
        } else {
          ln(jsonStr)
        }
        ln("```")
        ln()
      }
    }

    // ─── 7. Recommended Project Structure ───
    ln(`## 7. Recommended Project Structure`)
    ln()
    ln("```")
    ln(`src/`)
    ln(`├── app/`)
    ln(`│   ├── layout.tsx              ← Root layout (fetch brand, navbar, footer from API)`)
    ln(`│   ├── page.tsx                ← Homepage / Landing Page`)

    for (const ct of contentTypes) {
      ln(`│   ├── ${ct.slug}/`)
      ln(`│   │   ├── page.tsx            ← List page for ${ct.name}`)
      ln(`│   │   └── [id]/page.tsx       ← Detail page for ${ct.name}`)
    }

    for (const st of singleTypes) {
      if (st.slug.includes("landing") || st.slug.includes("home")) continue
      ln(`│   ├── ${st.slug}/page.tsx      ← ${st.name} page`)
    }

    ln(`│   └── not-found.tsx           ← 404 page`)
    ln(`├── lib/`)
    ln(`│   ├── api.ts                  ← API client (see Section 4)`)
    ln(`│   └── types.ts                ← TypeScript interfaces (see Section 3)`)
    ln(`├── components/`)
    ln(`│   ├── navbar.tsx              ← Navigation component`)
    ln(`│   ├── footer.tsx              ← Footer component`)
    ln(`│   ├── content-card.tsx        ← Card for collection entries`)
    ln(`│   ├── hero-section.tsx        ← Hero section (from CMS data)`)
    ln(`│   ├── rich-text.tsx           ← Rich text renderer (react-markdown)`)
    ln(`│   └── loading-skeleton.tsx    ← Skeleton loading states`)
    ln(`├── .env.example                ← Pre-filled configuration template`)
    ln(`└── .env.local                  ← Pre-filled envs (insert NEXT_PUBLIC_CMS_API_KEY manually)`)
    ln("```")
    ln()

    // ─── 8. Implementation Instructions ───
    ln(`## 8. Implementation Instructions`)
    ln()
    ln(`### Tech Stack`)
    ln(`- **Framework**: Next.js 14+ (App Router, Server Components)`)
    ln(`- **Styling**: Tailwind CSS v3+`)
    ln(`- **Icons**: Lucide React (\`lucide-react\`)`)
    ln(`- **Rich Text**: \`react-markdown\` + \`rehype-raw\` + \`remark-gfm\``)
    ln(`- **Images**: \`next/image\` with remote patterns configured`)
    ln()
    ln(`### Data Fetching Strategy`)
    ln(`- Use **Server Components** with \`fetch()\` and \`next: { revalidate: 60 }\` for ISR`)
    ln(`- Store \`NEXT_PUBLIC_CMS_API_KEY\` in \`.env.local\` — never expose confidential keys client-side`)
    ln(`- All API calls should go through the \`src/lib/api.ts\` client`)
    ln()
    ln(`### Rendering Rules`)
    ln(`1. **\`text\`** fields → Render as plain text or headings`)
    ln(`2. **\`textarea\`** fields → Render with \`whitespace-pre-wrap\` or as paragraphs`)
    ln(`3. **\`richText\`** fields → Render with \`react-markdown\`:`)
    ln("   ```tsx")
    ln(`   import ReactMarkdown from 'react-markdown'`)
    ln(`   import rehypeRaw from 'rehype-raw'`)
    ln(`   <ReactMarkdown rehypePlugins={[rehypeRaw]}>{content}</ReactMarkdown>`)
    ln("   ```")
    ln(`4. **\`media\`** fields → These are URLs. Render with \`next/image\`:`)
    ln("   ```tsx")
    ln(`   <Image src={mediaUrl} alt="..." width={800} height={400} />`)
    ln("   ```")
    ln(`5. **\`component\`** fields (repeatable) → Map over the array and render each item:`)
    ln("   ```tsx")
    ln(`   {data.features.map((feature, i) => (`)
    ln(`     <FeatureCard key={i} {...feature} />`)
    ln(`   ))}`)
    ln("   ```")
    ln(`6. **\`component\`** fields (single) → Render directly:`)
    ln("   ```tsx")
    ln(`   <FooterSection {...data.footer} />`)
    ln("   ```")
    ln(`7. **\`json\`** fields → Parse and render based on context`)
    ln(`8. **\`boolean\`** fields → Use for conditional rendering`)
    ln()
    ln(`### SEO`)
    ln(`- Use \`generateMetadata()\` in each page to set \`<title>\` and \`<meta name="description">\``)
    ln(`- Pull title/description from the CMS data when available`)
    ln()
    ln(`### Error Handling`)
    ln(`- Handle \`401 Unauthorized\` → Check API key configuration`)
    ln(`- Handle \`404 Not Found\` → Show \`notFound()\` page`)
    ln(`- Handle network errors → Show retry UI with \`error.tsx\``)
    ln()

    // ─── 9. Brand API ───
    ln(`## 9. White-Label Brand API`)
    ln()
    ln(`The Brand API requires **no authentication** and returns tenant branding:`)
    ln()
    ln(`\`GET ${fullApiBaseUrl}/brand\``)
    ln()
    ln("```json")
    ln(`{`)
    ln(`  "id": "${tenantId}",`)
    ln(`  "name": "${tenant.name}",`)
    ln(`  "slug": "${tenantSlug}",`)
    ln(`  "brandName": "...",`)
    ln(`  "brandLogo": "...",`)
    ln(`  "primaryColor": "#...",`)
    ln(`  "faviconUrl": "..."`)
    ln(`}`)
    ln("```")
    ln()
    ln(`Use this to dynamically theme your frontend (logo, colors, favicon, site name).`)
    ln()

    // ─── Footer ───
    ln(`---`)
    ln(`*Generated by SaCMS • ${new Date().toISOString()}*`)

    const prompt = lines.join("\n")

    return new NextResponse(prompt, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${tenantSlug}-ai-skill.md"`,
      },
    })
})
