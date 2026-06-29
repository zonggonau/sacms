import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/ui/logo"

interface NestedSidebarHeaderProps {
  tenantId: string
  backHref?: string
  backTooltip?: string
  logoHref?: string
}

export function NestedSidebarHeader({ 
  tenantId, 
  backHref, 
  backTooltip = "Back to Workspace Dashboard",
  logoHref
}: NestedSidebarHeaderProps) {
  const actualBackHref = backHref || `/dashboard/${tenantId}`
  const actualLogoHref = logoHref || `/dashboard/${tenantId}`

  return (
    <div className="border-b border-border px-4 py-5 bg-card flex items-center gap-2">
      <Link 
        href={actualBackHref} 
        title={backTooltip}
        className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 transition-all rounded-none border border-transparent hover:border-border flex items-center justify-center shrink-0"
      >
        <ArrowLeft className="h-4.5 w-4.5" />
      </Link>
      <Link href={actualLogoHref} className="flex items-center gap-3 min-w-0">
        <Logo iconSize="sm" showText={true} />
      </Link>
    </div>
  )
}
