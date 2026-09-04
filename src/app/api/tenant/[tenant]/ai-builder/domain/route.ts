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
      // When the Vercel config check itself failed (bad token, rate limit,
      // 5xx), `configured: false` above does NOT mean the domain's DNS is
      // actually wrong — it means we couldn't check. Surface that distinctly
      // instead of letting the client tell the user their DNS is broken.
      configCheckError: config.error,
    })
  },
  { minRole: "admin" },
)

export const GET = withStaffAuth(async (req) => {
  const domain = req.nextUrl.searchParams.get("domain")
  if (!domain) return apiError("validation", { message: "domain query param is required" })
  const config = await getDomainConfig(domain)
  if (config.error) {
    return apiError("internal", { message: config.error })
  }
  return NextResponse.json(config)
})
