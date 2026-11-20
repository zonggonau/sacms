import Link from "next/link"
import { MapPin, ArrowRight } from "lucide-react"
import type { LocalPrideData } from "../types"

/**
 * Compact, single-line version of the Papua identity story (full version
 * used to be its own hero-sized section on the homepage — see the deleted
 * papua-pride-section.tsx). Real data (badge/title), not fabricated copy;
 * links through to /tentang for the full story.
 */
export function LocalPrideStrip({ data }: { data?: LocalPrideData | null }) {
  if (!data?.title && !data?.badge) return null

  return (
    <div className="border-t border-border/50 bg-card/30">
      <Link
        href="/tentang"
        className="group container px-4 sm:px-6 max-w-6xl mx-auto flex items-center justify-center gap-2.5 py-4 text-center hover:bg-muted/30 transition-colors"
      >
        <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-xs sm:text-sm font-semibold text-foreground">
          {data.badge || "Dibangun di Nabire, Papua Tengah"}
          {data.title && <span className="text-muted-foreground font-medium"> — {data.title}</span>}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </Link>
    </div>
  )
}
