import DOMPurify from "isomorphic-dompurify"

/**
 * Sanitizes rich-text HTML (authored via the Quill editor, lib/r2.ts has no
 * part in this) before it's rendered with `dangerouslySetInnerHTML` on
 * SaCMS's own first-party pages (landing sections, blog). Defense in depth
 * against Quill's own un-patched XSS advisory (GHSA-v3m3-f69x-jf25, no fixed
 * version exists upstream) and against any other HTML a content editor
 * might paste in — not a replacement for a consumer's own sanitization when
 * they render raw content pulled from the public Content API themselves,
 * which SaCMS (a headless CMS) never sanitizes on their behalf.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ""
  return DOMPurify.sanitize(html)
}
