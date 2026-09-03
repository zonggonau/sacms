import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { db } from "@/lib/database"

/**
 * Vercel signs each webhook with HMAC-SHA1 of the raw request body, keyed by the
 * integration's client secret, in the `x-vercel-signature` header.
 * https://vercel.com/docs/integrations/create-integration/webhooks#securing-webhooks
 */
function verifyVercelSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET
  if (!secret || !signature) return false
  const expected = createHmac("sha1", secret).update(rawBody).digest("hex")
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    if (!verifyVercelSignature(rawBody, req.headers.get("x-vercel-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    if (
      body.type === "deployment.created" ||
      body.type === "deployment.succeeded" ||
      body.type === "deployment.error" ||
      body.type === "deployment.canceled"
    ) {
      const payload = body.payload
      const deploymentId = payload?.deployment?.id
      const url = payload?.deployment?.url ? `https://${payload.deployment.url}` : null

      let status = "building"
      if (body.type === "deployment.succeeded") status = "deployed"
      if (body.type === "deployment.error" || body.type === "deployment.canceled") status = "failed"

      console.log(`[Vercel Webhook] Deployment ${deploymentId} changed to ${status}`)

      const deployment = url
        ? await db.siteDeployment.findFirst({ where: { url } })
        : null

      if (deployment) {
        let deploymentLogs: string | null = null
        if (status === "failed") {
          try {
            const { getDeploymentStatus } = await import("@/lib/vercel-client")
            const vercelData = await getDeploymentStatus(deploymentId)
            deploymentLogs = `Build failed on Vercel (State: ${vercelData.state}).`
          } catch {
            deploymentLogs = "Deployment failed on Vercel."
          }
        }

        await db.siteDeployment.update({
          where: { id: deployment.id },
          data: {
            status: status === "deployed" ? "ready" : status === "failed" ? "error" : "building",
            url: url || deployment.url,
            logs: deploymentLogs || deployment.logs,
          },
        })
        console.log(`[Vercel Webhook] Updated deployment ${deployment.id}`)
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("[Vercel Webhook] Error processing webhook:", error)
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
