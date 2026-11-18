/**
 * Real visual preview for a deployed Website Template demo, for use in a
 * plain <img> tag.
 *
 * An <iframe> pointed at the demo URL (the original approach) rendered
 * blank in both the dashboard's Website Template gallery and the admin
 * catalog page — confirmed live: every demo's own Next.js app sends a
 * `frame-ancestors`/X-Frame-Options header (same-origin default, nothing
 * in this codebase ever opts a template's frontend OUT of it) that blocks
 * third-party iframe embedding outright, even though the exact same URL
 * opens perfectly fine in its own tab/window (navigation, unlike framing,
 * isn't covered by that header at all).
 *
 * An <img> tag is NOT subject to frame-ancestors/X-Frame-Options (those
 * headers only ever apply to framing, never to a plain resource fetch),
 * so a server-rendered screenshot sidesteps the restriction entirely
 * without needing every template's own frontend to change anything.
 * Microlink's public screenshot endpoint (api.microlink.io) needs no API
 * key for this volume and is widely used for exactly this "link preview
 * thumbnail" purpose; it caches a URL's screenshot behind its own CDN, so
 * repeat views of the same template don't re-trigger a fresh capture.
 */
export function getWebsitePreviewUrl(demoUrl: string): string {
  const params = new URLSearchParams({
    url: demoUrl,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    colorScheme: "light",
    "viewport.width": "1280",
    "viewport.height": "800",
  })
  return `https://api.microlink.io/?${params.toString()}`
}

/**
 * A deterministic per-template gradient tile, shown underneath a template
 * preview image as its loading/error fallback (and as the only visual
 * when a template has no demoUrl yet) — same spirit as vercel.com/templates'
 * own fallback art for a template with no screenshot.
 */
const CARD_GRADIENTS = [
  "from-violet-500/20 via-fuchsia-500/10 to-transparent",
  "from-sky-500/20 via-cyan-500/10 to-transparent",
  "from-amber-500/20 via-orange-500/10 to-transparent",
  "from-emerald-500/20 via-teal-500/10 to-transparent",
  "from-rose-500/20 via-pink-500/10 to-transparent",
  "from-indigo-500/20 via-blue-500/10 to-transparent",
]
export function gradientFor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}
