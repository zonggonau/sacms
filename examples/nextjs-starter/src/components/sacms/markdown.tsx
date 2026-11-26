import ReactMarkdown from "react-markdown"

// Renders markdown (raw Markdown source, not HTML). react-markdown does not
// render raw HTML inside the source, which keeps it safe by default.
export function Markdown({ source, className }: { source: string; className?: string }) {
  return (
    <div className={className ?? "space-y-3 leading-relaxed"}>
      <ReactMarkdown>{source}</ReactMarkdown>
    </div>
  )
}
