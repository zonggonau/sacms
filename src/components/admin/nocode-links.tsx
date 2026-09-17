import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

/** Rupiah without formatRupiah's "Gratis" for zero — margins can be zero or negative. */
export function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value)
}

/**
 * Link into the nocode admin. Actions on nocode data only exist there (nocode
 * ADR-016), so every "do something" in the SaCMS portal is a link out.
 */
export function NocodeAdminLink({
  baseUrl,
  path,
  children,
  className,
}: {
  baseUrl: string
  path: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <a
      href={`${baseUrl}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("inline-flex items-center gap-1 font-medium text-primary hover:underline", className)}
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
    </a>
  )
}
