import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { getTenantAccess } from "@/lib/tenant-access"
import { addDomainToProject, getDomainConfig } from "@/lib/vercel-client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const { domain } = await req.json()
    
    if (!domain) return NextResponse.json({ error: "Domain is required" }, { status: 400 })

    const access = await getTenantAccess(session, tenantSlug)
    if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 })
    
    const tenant = access.tenant

    // Get vercel project ID
    const projectSetting = await db.setting.findUnique({ where: { key: `${tenant.id}_vercelProjectId` } })
    if (!projectSetting?.value) {
      return NextResponse.json({ error: "No Vercel deployment found. Please deploy your frontend first." }, { status: 400 })
    }

    const result = await addDomainToProject(projectSetting.value, domain)
    const config = await getDomainConfig(domain)

    return NextResponse.json({ 
      success: true, 
      domain: result.name,
      verified: result.verified,
      verificationRequired: result.verificationRequired,
      verificationRecords: result.verificationRecords,
      cname: config.cname || "cname.vercel-dns.com",
      configured: config.configured
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to add domain" }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { tenant: tenantSlug } = await params
    const domain = req.nextUrl.searchParams.get("domain")
    if (!domain) return NextResponse.json({ error: "domain query param is required" }, { status: 400 })

    const config = await getDomainConfig(domain)
    return NextResponse.json(config)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
