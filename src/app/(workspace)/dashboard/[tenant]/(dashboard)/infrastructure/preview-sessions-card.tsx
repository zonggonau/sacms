"use client"

export type PreviewEntry = {
  label: string
  websiteTemplateId: string | null
  demoUrl: string | null
  session: { status: string; previewUrl: string | null; accessUrl: string | null }
}

export function PreviewSessionsCard({ previews }: { previews: PreviewEntry[] }) {
  const links = previews.flatMap((p) => [
    ...(p.session.status === "ready" && p.session.accessUrl ? [{ key: `${p.label}-preview`, label: `Preview ${p.label}`, href: p.session.accessUrl, text: p.session.previewUrl }] : []),
    ...(p.demoUrl ? [{ key: `${p.label}-demo`, label: `Demo ${p.label}`, href: p.demoUrl, text: p.demoUrl }] : []),
  ])
  if (links.length === 0) return null
  return (
    <div className="space-y-1 text-xs">
      {links.map((l) => (
        <p key={l.key} className="break-all">
          <span className="text-muted-foreground">{l.label}: </span>
          <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline">{l.text}</a>
        </p>
      ))}
    </div>
  )
}
