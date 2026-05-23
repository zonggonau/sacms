import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantDb } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"

/**
 * GET /api/tenant/[tenant]/developer/ai-prompt
 * Generates an AI prompt for z.ai to create a frontend for this tenant's schema.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const { tenant: tenantSlug } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Forbidden or Tenant not found" }, { status: 403 })
    }

    const tenantId = access.tenantId
    const tenantDb = await getTenantDb(tenantSlug)

    // Fetch Tenant Info
    const tenant = await tenantDb.tenant.findUnique({
      where: { id: tenantId }
    })

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 })
    }

    // Fetch Content Types (Collection Types)
    const contentTypes = await tenantDb.contentType.findMany({
      where: {
        OR: [
          { tenantId: tenantId },
          {
            tenants: {
              some: {
                tenantId: tenantId,
                enabled: true
              }
            }
          }
        ]
      },
      include: {
        fields: {
          orderBy: { order: "asc" },
        },
      },
    })

    // Fetch Single Types
    const singleTypes = await tenantDb.singleType.findMany({
      where: {
        OR: [
          { tenantId: tenantId },
          { 
            tenantId: null,
            tenants: { some: { tenantId: tenantId, enabled: true } }
          }
        ]
      },
      include: {
        fields: { orderBy: { order: 'asc' } }
      },
    })

    // Fetch an active API Token for this tenant
    const apiToken = await tenantDb.apiToken.findFirst({
      where: {
        tenantId: tenantId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    })
    const tokenStr = apiToken ? apiToken.token : "[No Active API Token Found - Create one in Settings]"

    const baseUrl = request.nextUrl.origin
    const fullApiBaseUrl = `${baseUrl}/api/public/${tenantSlug}`

    // Generate Markdown Prompt
    let prompt = `# AI Agent Prompt for ${tenant.name}\n\n`
    prompt += `You are an expert Frontend Developer. Your task is to build a complete, modern, and responsive frontend application using Next.js (App Router), Tailwind CSS, and Lucide React icons based on the following Headless CMS schema for "${tenant.name}".\n\n`
    
    prompt += `## Project Configuration\n`
    prompt += `- **Tenant Name**: ${tenant.name}\n`
    prompt += `- **Tenant ID**: \`${tenantId}\`\n`
    prompt += `- **Tenant Slug**: \`${tenantSlug}\`\n`
    prompt += `- **API Key (Bearer Token)**: \`${tokenStr}\`\n`
    prompt += `- **Base API URL**: \`${fullApiBaseUrl}\`\n`
    prompt += `- **Authentication**: Use \`Bearer ${tokenStr}\` in the Authorization header.\n\n`

    prompt += `## Schema Definition\n\n`

    if (contentTypes.length > 0) {
      prompt += `### Collection Types (Multiple Entries)\n`
      prompt += `These types represent collections of data. You should create list pages and individual detail pages for these.\n\n`
      
      contentTypes.forEach(ct => {
        prompt += `#### ${ct.name} (\`${ct.slug}\`)\n`
        if (ct.description) prompt += `*Description: ${ct.description}*\n\n`
        prompt += `- **Endpoints**:\n`
        prompt += `  - List: \`GET ${fullApiBaseUrl}/content/${ct.slug}\`\n`
        prompt += `  - Detail: \`GET ${fullApiBaseUrl}/content/${ct.slug}/:id\`\n`
        prompt += `- **Fields**:\n`
        ct.fields.forEach(f => {
          prompt += `  - \`${f.slug}\` (${f.type})${f.required ? ' *Required*' : ''}\n`
        })
        prompt += `\n`
      })
    }

    if (singleTypes.length > 0) {
      prompt += `### Single Types (Unique Content)\n`
      prompt += `These types represent unique pages or global settings (e.g., Homepage, About Us, Global Settings).\n\n`
      
      singleTypes.forEach(st => {
        prompt += `#### ${st.name} (\`${st.slug}\`)\n`
        if (st.description) prompt += `*Description: ${st.description}*\n\n`
        prompt += `- **Endpoint**: \`GET ${fullApiBaseUrl}/single/${st.slug}\`\n`
        prompt += `- **Fields**:\n`
        st.fields.forEach(f => {
          prompt += `  - \`${f.slug}\` (${f.type})${f.required ? ' *Required*' : ''}\n`
        })
        prompt += `\n`
      })
    }

    prompt += `## Implementation Instructions\n\n`
    prompt += `1. **Modern UI/UX**: Use a clean, modern design with plenty of whitespace. Ensure it is fully responsive.\n`
    prompt += `2. **State Management**: Use React Hooks (\`useState\`, \`useEffect\`) or React Query for data fetching.\n`
    prompt += `3. **Data Fetching**: Create a clean API client to interact with the endpoints. Handle loading and error states gracefully.\n`
    prompt += `4. **Components**: Use reusable UI components (Buttons, Cards, Inputs, etc.).\n`
    prompt += `5. **Navigation**: Setup a main navigation bar that includes links to the list pages of all Collection Types and the pages for all Single Types.\n`
    prompt += `6. **Rich Content**: \n`
    prompt += `   - For \`richText\` fields, use a library like \`react-markdown\` or similar to render the content.\n`
    prompt += `   - For \`media\` and \`mediaMultiple\` fields, render images correctly.\n`
    prompt += `7. **SEO**: Implement meta tags for each page using the data from the CMS (if available).\n\n`
    
    prompt += `Please generate the complete codebase for this frontend application.\n`

    return new NextResponse(prompt, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="${tenantSlug}-ai-prompt.md"`,
      },
    })
  } catch (error) {
    console.error("Error generating AI prompt:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
