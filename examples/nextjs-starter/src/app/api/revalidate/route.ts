import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { readEnv } from "@/lib/env"
import { isContentChangeEvent, verifyWebhookSignature } from "@/lib/webhook"

// Receives SaCMS webhooks and refreshes the site. Point the SaCMS webhook at
// https://<your-site>/api/revalidate and set the same secret in
// SACMS_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const config = readEnv()
  const secret = config.ok ? config.env.webhookSecret : undefined
  if (!secret) {
    return NextResponse.json({ error: "Webhook belum dikonfigurasi (SACMS_WEBHOOK_SECRET kosong)." }, { status: 503 })
  }

  const rawBody = await request.text()
  if (!verifyWebhookSignature(rawBody, request.headers.get("x-webhook-signature"), secret)) {
    return NextResponse.json({ error: "Tanda tangan tidak valid." }, { status: 401 })
  }

  const event = request.headers.get("x-webhook-event")
  if (!isContentChangeEvent(event)) {
    return NextResponse.json({ revalidated: false, event, reason: "Event ini tidak mengubah konten publik." })
  }

  // Refresh the whole site. The starter does not track which page shows which
  // record, so this is the safe choice. Narrow it later if the site grows.
  revalidatePath("/", "layout")
  return NextResponse.json({ revalidated: true, event })
}
