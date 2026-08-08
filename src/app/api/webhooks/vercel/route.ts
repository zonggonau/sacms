import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/database"

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("x-vercel-signature")
    
    // In production, you would verify the signature using crypto
    // const bodyText = await req.text()
    // verifyVercelSignature(bodyText, signature, process.env.VERCEL_WEBHOOK_SECRET)
    
    const body = await req.json()
    
    // Check if this is a deployment webhook
    if (body.type === "deployment.created" || body.type === "deployment.succeeded" || body.type === "deployment.error" || body.type === "deployment.canceled") {
      const payload = body.payload
      const deploymentId = payload.deployment.id
      const url = payload.deployment.url ? `https://${payload.deployment.url}` : null
      
      let status = "building"
      if (body.type === "deployment.succeeded") status = "deployed"
      if (body.type === "deployment.error" || body.type === "deployment.canceled") status = "failed"

      console.log(`[Vercel Webhook] Deployment ${deploymentId} changed to ${status}`)

      // Update the FrontendBuild in the database
      const build = await db.frontendBuild.findFirst({
        where: { deploymentId }
      })

      if (build) {
        let deploymentError: string | null = null
        if (status === "failed") {
          try {
            // Import dynamically to avoid circular dependency issues if any
            const { checkVercelDeploymentStatus } = await import("@/lib/ai-engine")
            const vercelData = await checkVercelDeploymentStatus(deploymentId)
            deploymentError = vercelData.error || `Build failed on Vercel. Check logs here: ${vercelData.inspectorUrl}`
          } catch (e) {
            deploymentError = "Deployment failed on Vercel."
          }
        }

        await db.frontendBuild.update({
          where: { id: build.id },
          data: {
            deploymentStatus: status,
            status: status === "building" ? "deploying" : status,
            deploymentUrl: url || build.deploymentUrl,
            deploymentError: deploymentError
          }
        })
        console.log(`[Vercel Webhook] Successfully updated build ${build.id}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[Vercel Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
