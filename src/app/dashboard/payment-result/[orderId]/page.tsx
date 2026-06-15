"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function GlobalPaymentResultPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const orderId = params?.orderId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }

    if (status === "authenticated" && orderId) {
      const resolveAndRedirect = async () => {
        try {
          const res = await fetch(`/api/billing/payment/${orderId}/status`)
          if (!res.ok) throw new Error("Payment not found")
          
          const data = await res.json()
          if (data.subscription?.tenant?.slug) {
            router.push(`/dashboard/${data.subscription.tenant.slug}/subscriptions/payment/${orderId}`)
          } else {
            // Fallback: look for tenant ID in orderId if API fails to provide slug
            const parts = orderId.split("-")
            if (parts.length >= 2) {
              const tenantId = parts[1]
              // Try to find tenant slug by ID
              const tRes = await fetch(`/api/admin/tenants/${tenantId}`)
              if (tRes.ok) {
                const tData = await tRes.json()
                router.push(`/dashboard/${tData.slug}/subscriptions/payment/${orderId}`)
                return
              }
            }
            router.push("/dashboard")
          }
        } catch (err) {
          console.error("Redirect error:", err)
          setError("Could not resolve payment details. Please check your dashboard.")
          setLoading(false)
        }
      }

      resolveAndRedirect()
    }
  }, [status, orderId, router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center space-y-4 bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
        <p className="text-sm font-black animate-pulse uppercase tracking-widest text-muted-foreground">Resolving Workspace...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6 bg-background text-foreground">
      <div className="w-16 h-16 rounded-none bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
        <AlertCircle className="h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-black uppercase tracking-tight">Something went wrong</h1>
        <p className="text-xs font-medium text-muted-foreground max-w-md mx-auto">{error}</p>
      </div>
      <Button onClick={() => router.push("/dashboard")} className="font-black px-8 h-12 rounded-none bg-orange-500 hover:bg-orange-600 text-white border-none shadow-none uppercase tracking-wider text-xs">
        Back to Dashboard
      </Button>
    </div>
  )
}
