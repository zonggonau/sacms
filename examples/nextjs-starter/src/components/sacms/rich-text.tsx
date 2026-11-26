import DOMPurify from "isomorphic-dompurify"

// Renders richText (HTML from the SaCMS editor). SaCMS stores what the editor
// produces and does not sanitize it for you, so it is sanitized here before it
// reaches the page. Server-only: DOMPurify runs on the server during render.
export function RichText({ html, className }: { html: string; className?: string }) {
  const clean = DOMPurify.sanitize(html)
  return <div className={className ?? "space-y-3 leading-relaxed [&_a]:underline [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:text-xl [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"} dangerouslySetInnerHTML={{ __html: clean }} />
}
