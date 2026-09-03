import { NextResponse } from "next/server"
import { db } from "@/lib/database"
import { addDomainToProject, getDomainConfig } from "@/lib/vercel-client"
import { withStaffAuth, apiError } from "@/lib/api/route-helpers"

export const POST = withStaffAuth(
  async (req, _context, { access }) => {
    const { domain } = await req.json()
    if (!domain) return apiError("validation", { message: "Domain is required" })

    const tenant = access.tenant
    const projectSetting = await db.setting.findUnique({ where: { key: `${tenant.id}_vercelProjectId` } })
    if (!projectSetting?.value) {
      return apiError("validation", {
        message: "No Vercel deployment found. Please deploy your frontend first.",
      })
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
      configured: config.configured,
    })
  },
  { minRole: "admin" },
)

export const GET = withStaffAuth(async (req) => {
  const domain = req.nextUrl.searchParams.get("domain")
  if (!domain) return apiError("validation", { message: "domain query param is required" })
  return NextResponse.json(await getDomainConfig(domain))
})
