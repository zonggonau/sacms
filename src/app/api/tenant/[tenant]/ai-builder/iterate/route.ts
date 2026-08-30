import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { iterateV0Chat, getV0Preview } from "@/lib/v0-client"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenant: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { chatId, prompt } = await req.json()
    if (!chatId || !prompt) {
      return NextResponse.json({ error: "Missing chatId or prompt" }, { status: 400 })
    }

    const { tenant: tenantSlug } = await params

    // Validate tenant access — critical for multi-tenant data isolation
    const access = await getTenantAccess(session, tenantSlug)
    if (!access) {
      return NextResponse.json({ error: "Tenant not found or unauthorized" }, { status: 404 })
    }

    // Check user account AI credits (5 credits for UI iteration)
    const { enforceUserAiCredits, deductUserAiCredits } = await import("@/lib/plan-enforcement")
    const creditCheck = await enforceUserAiCredits(session.user.id, 5)
    if (!creditCheck.allowed) {
      return NextResponse.json({ error: creditCheck.message }, { status: 429 })
    }

    // Call v0 API to iterate
    const iterRes = await iterateV0Chat(chatId, prompt)
    
    // Deduct user credits after successful iteration
    await deductUserAiCredits(session.user.id, 5, "iterate_frontend", access.tenant.id, "v0.dev")
    
    // Use local proxy route to securely embed the V0 preview
    const previewUrl = `/api/tenant/${tenantSlug}/ai-builder/preview/${chatId}`

    return NextResponse.json({ success: true, previewUrl, files: iterRes?.files || [] })
  } catch (error: any) {
    console.error("AI iteration failed:", error)
    return NextResponse.json({ error: error.message || "Failed to iterate" }, { status: 500 })
  }
}
