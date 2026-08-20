import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/ui/logo"

interface NestedSidebarHeaderProps {
  tenantId?: string
  backHref?: string
  backTooltip?: string
  logoHref?: string
  showBackBtn?: boolean
}

export function NestedSidebarHeader({ 
  tenantId, 
  backHref, 
  backTooltip = "Back to Workspace Dashboard",
  logoHref,
  showBackBtn = true
}: NestedSidebarHeaderProps) {
  const actualBackHref = backHref || (tenantId ? `/dashboard/${tenantId}` : "/dashboard")
  const actualLogoHref = logoHref || (tenantId ? `/dashboard/${tenantId}` : "/dashboard")

  return (
    <div className="border-b border-border px-4 py-5 bg-card flex items-center gap-2">
      {showBackBtn && (
        <Link 
          href={actualBackHref} 
          title={backTooltip}
          className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 transition-all rounded-xl border border-border/60 flex items-center justify-center shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
      )}
      <Link href={actualLogoHref} className="flex items-center gap-3 min-w-0">
        <Logo iconSize="sm" showText={true} />
      </Link>
    </div>
  )
}
