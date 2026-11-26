import { createHmac, timingSafeEqual } from "crypto"

// SaCMS signs the raw JSON body with HMAC-SHA256 and sends the result as
// `X-Webhook-Signature: sha256=<hex>`. Verify against the raw body, before
// parsing it, because re-serializing the JSON can change the bytes.
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !header.startsWith("sha256=")) return false

  const expected = createHmac("sha256", secret).update(rawBody).digest()
  const received = Buffer.from(header.slice("sha256=".length), "hex")
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}

// Events that mean published content changed. The "before*" events are sync
// hooks that run before a write, so they never mean the site needs a refresh.
export function isContentChangeEvent(event: string | null): boolean {
  if (!event) return false
  if (event.includes(".before")) return false
  return event.startsWith("content.") || event.startsWith("media.")
}
