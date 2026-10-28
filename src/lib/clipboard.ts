// The Clipboard API (`navigator.clipboard`) only exists in a secure context
// (HTTPS, or the exact hostname "localhost") — on any other plain-HTTP host
// (e.g. a local *.test domain, or a tenant subdomain visited over HTTP as an
// SSL-outage workaround) `navigator.clipboard` is `undefined`, so every
// `navigator.clipboard.writeText(...)` call site in the app throws
// "Cannot read properties of undefined (reading 'writeText')". This falls
// back to the legacy execCommand("copy") technique, which still works over
// plain HTTP.
export function copyToClipboard(text: string): void {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => legacyCopy(text))
    return
  }
  legacyCopy(text)
}

function legacyCopy(text: string): void {
  if (typeof document === "undefined") return
  const textarea = document.createElement("textarea")
  textarea.value = text
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  try {
    document.execCommand("copy")
  } catch {
    // Clipboard genuinely unavailable — nothing more we can do silently.
  }
  document.body.removeChild(textarea)
}
