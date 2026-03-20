"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"

function FailedContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  useEffect(() => {
    if (orderId) {
      router.push(`/dashboard/payment-result/${orderId}`)
    } else {
      router.push("/dashboard")
    }
  }, [orderId, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-12 w-12 animate-spin text-destructive" />
      <p className="text-lg font-bold animate-pulse uppercase tracking-widest text-destructive">Payment Failed...</p>
    </div>
  )
}

export default function PaymentFailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <FailedContent />
    </Suspense>
  )
}
