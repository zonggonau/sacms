import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { Badge } from "@/components/ui/badge"

interface NestedSidebarHeaderProps {
  tenantId?: string
  backHref?: string
  backTooltip?: string
  logoHref?: string
  showBackBtn?: boolean
  portalBadge?: string
}

export function NestedSidebarHeader({ 
  tenantId, 
  backHref, 
  backTooltip = "Kembali ke Dashboard Workspace",
  logoHref,
  showBackBtn = true,
  portalBadge
}: NestedSidebarHeaderProps) {
  const actualBackHref = backHref || (tenantId ? `/dashboard/${tenantId}` : "/dashboard")
  const actualLogoHref = logoHref || (tenantId ? `/dashboard/${tenantId}` : "/dashboard")

  return (
    <div className="border-b border-border px-4 py-4 bg-card flex items-center justify-between gap-2 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {showBackBtn && (
          <Link 
            href={actualBackHref} 
            title={backTooltip}
            className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 transition-all rounded-xl border border-border/60 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        )}
        <Link href={actualLogoHref} className="flex items-center gap-2.5 min-w-0">
          <Logo iconSize="sm" showText={true} showDetail={true} />
        </Link>
      </div>

      {portalBadge && (
        <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border-primary/20 bg-primary/5 text-primary shrink-0">
          {portalBadge}
        </Badge>
      )}
    </div>
  )
}
