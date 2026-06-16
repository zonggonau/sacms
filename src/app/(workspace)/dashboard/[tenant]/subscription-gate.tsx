"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Zap } from "lucide-react"

export function SubscriptionGate({ 
  isExpired, 
  tenantId, 
  children 
}: { 
  isExpired: boolean
  tenantId: string
  children: React.ReactNode 
}) {
  const pathname = usePathname()

  if (isExpired && !pathname.includes("/subscriptions")) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background border-l border-border min-h-screen">
        <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-6 border border-orange-200">
          <AlertTriangle className="h-10 w-10 text-orange-500" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight mb-3">Workspace Locked</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          Your trial period has expired. To regain access to your dashboard, content, and settings, please choose a subscription plan.
        </p>
        <Link href={`/dashboard/${tenantId}/subscriptions`}>
          <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold h-12 px-8 rounded-none text-lg border-none shadow-md hover:shadow-lg transition-all">
            <Zap className="w-5 h-5 mr-2 fill-current" />
            Go to Billing & Subscriptions
          </Button>
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
