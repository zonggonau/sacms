"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  useEffect(() => {
    if (orderId) {
      // Extract tenant slug from orderId (format: SUB-tenantId-timestamp or ADD-tenantId-timestamp)
      const parts = orderId.split("-")
      if (parts.length >= 2) {
        const tenantId = parts[1]
        // Since we don't have the slug here directly, we'll redirect to a generic payment handler 
        // that can resolve the tenant and order details
        router.push(`/dashboard/payment-result/${orderId}`)
      } else {
        router.push("/dashboard")
      }
    } else {
      router.push("/dashboard")
    }
  }, [orderId, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
      <p className="text-sm font-black animate-pulse uppercase tracking-widest text-muted-foreground">Processing Payment...</p>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin text-orange-500" /></div>}>
      <SuccessContent />
    </Suspense>
  )
}
