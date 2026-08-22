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

      // Update the SiteDeployment in the database
      const deployment = await db.siteDeployment.findFirst({
        where: { url: url || undefined }
      })

      if (deployment) {
        let deploymentLogs: string | null = null
        if (status === "failed") {
          try {
            const { getDeploymentStatus } = await import("@/lib/vercel-client")
            const vercelData = await getDeploymentStatus(deploymentId)
            deploymentLogs = `Build failed on Vercel (State: ${vercelData.state}).`
          } catch (e) {
            deploymentLogs = "Deployment failed on Vercel."
          }
        }

        await db.siteDeployment.update({
          where: { id: deployment.id },
          data: {
            status: status === "deployed" ? "ready" : (status === "failed" ? "error" : "building"),
            url: url || deployment.url,
            logs: deploymentLogs || deployment.logs
          }
        })
        console.log(`[Vercel Webhook] Successfully updated deployment ${deployment.id}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error("[Vercel Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
