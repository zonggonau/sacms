"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react"

export default function PaymentResultPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const orderId = params?.orderId as string

  const [status, setStatus] = useState<"loading" | "success" | "failed" | "pending">("loading")
  const [transaction, setTransaction] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user) {
      router.push("/login")
      return
    }

    const fetchTransactionStatus = async () => {
      try {
        const res = await fetch(`/api/payment/${orderId}/status`)
        
        if (!res.ok) {
          throw new Error("Failed to fetch transaction status")
        }

        const data = await res.json()
        setTransaction(data)

        // Set status based on transaction
        if (data.status === "success") {
          setStatus("success")
        } else if (data.status === "failed") {
          setStatus("failed")
        } else {
          setStatus("pending")
        }
      } catch (err) {
        console.error("Error fetching transaction:", err)
        setError("Failed to load payment status")
        setStatus("failed")
      }
    }

    fetchTransactionStatus()

    // Poll for status updates every 3 seconds if still loading or pending
    const interval = setInterval(() => {
      if (status === "loading" || status === "pending") {
        fetchTransactionStatus()
      } else {
        clearInterval(interval)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [session, orderId, status])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return (
          <div className="w-16 h-16 rounded-none bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
            <CheckCircle2 className="h-10 w-10" />
          </div>
        )
      case "failed":
        return (
          <div className="w-16 h-16 rounded-none bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <XCircle className="h-10 w-10" />
          </div>
        )
      case "pending":
        return (
          <div className="w-16 h-16 rounded-none bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 animate-pulse">
            <Clock className="h-10 w-10" />
          </div>
        )
      default:
        return (
          <div className="w-16 h-16 rounded-none bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
            <Loader2 className="h-10 w-10 animate-spin" />
          </div>
        )
    }
  }

  const getStatusTitle = () => {
    switch (status) {
      case "success":
        return "Payment Successful!"
      case "failed":
        return "Payment Failed"
      case "pending":
        return "Payment Pending"
      default:
        return "Processing Payment"
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case "success":
        return "Your subscription has been activated successfully. You can now access all the features of your new plan."
      case "failed":
        return "We couldn't process your payment. Please try again or contact support if the problem persists."
      case "pending":
        return "Your payment is being processed. This may take a few moments. Please wait while we confirm your payment."
      default:
        return "Please wait while we confirm your payment status..."
    }
  }

  return (
    <div className="p-6 lg:p-8 flex items-center justify-center text-foreground flex-1 flex-col w-full">
      <div className="max-w-2xl w-full">
        <Card className="border border-border rounded-none shadow-none bg-card text-card-foreground">
          <CardHeader className="text-center pb-6 border-b border-border rounded-none">
            <div className="flex justify-center mb-6">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-3xl font-black uppercase tracking-tight">{getStatusTitle()}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium mt-2 max-w-md mx-auto">
              {getStatusMessage()}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive font-bold text-xs uppercase tracking-wider rounded-none">
                {error}
              </div>
            )}

            {transaction && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Transaction Details</h3>
                  <div className="space-y-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Order ID</span>
                      <span className="font-mono text-foreground font-black">{transaction.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Amount</span>
                      <span className="text-foreground font-black text-sm">{formatPrice(transaction.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Payment Method</span>
                      <span className="text-foreground font-black capitalize">
                        {transaction.paymentType || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Transaction ID</span>
                      <span className="font-mono text-foreground font-black">
                        {transaction.transactionId || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Date</span>
                      <span className="text-foreground font-black">
                        {new Date(transaction.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                {transaction.subscription && (
                  <div className="border-t border-border pt-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-4">Subscription</h3>
                    <div className="space-y-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Plan</span>
                        <span className="text-foreground font-black uppercase tracking-widest">
                          {transaction.subscription.plan}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status</span>
                        <span
                          className={`font-black uppercase tracking-widest ${
                            transaction.subscription.status === "active"
                              ? "text-orange-500"
                              : "text-orange-500/70"
                          }`}
                        >
                          {transaction.subscription.status}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
                variant="outline"
                className="flex-1 rounded-none font-bold uppercase text-xs h-12 shadow-none border-border hover:bg-muted"
              >
                Back to Subscriptions
              </Button>
              {status === "success" && (
                <Button
                  onClick={() => router.push(`/dashboard/${tenantSlug}`)}
                  className="flex-1 rounded-none font-bold uppercase text-xs h-12 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-none"
                >
                  Go to Dashboard
                </Button>
              )}
              {(status === "failed" || status === "pending") && (
                <Button
                  onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions/checkout`)}
                  className="flex-1 rounded-none font-bold uppercase text-xs h-12 bg-orange-500 hover:bg-orange-600 text-white border-none shadow-none"
                >
                  Try Again
                </Button>
              )}
            </div>

            {status === "pending" && (
              <div className="mt-6 p-4 bg-orange-500/5 border border-orange-500/10 rounded-none">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-orange-500 uppercase tracking-wider block mb-1">Note:</strong> Some payment methods (like bank transfers) may take longer
                  to process. You can check back later or refresh this page to see the latest
                  status.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => router.push(`/dashboard/${tenantSlug}`)}
            className="text-muted-foreground hover:text-foreground font-black text-xs uppercase tracking-widest rounded-none"
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}