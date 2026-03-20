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
        return <CheckCircle2 className="h-16 w-16 text-green-500" />
      case "failed":
        return <XCircle className="h-16 w-16 text-red-500" />
      case "pending":
        return <Clock className="h-16 w-16 text-yellow-500" />
      default:
        return <Loader2 className="h-16 w-16 animate-spin text-primary" />
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        <Card>
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-3xl">{getStatusTitle()}</CardTitle>
            <CardDescription className="text-base mt-2">
              {getStatusMessage()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg">
                {error}
              </div>
            )}

            {transaction && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Transaction Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Order ID</span>
                      <span className="font-mono">{transaction.orderId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span className="font-semibold">{formatPrice(transaction.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="capitalize">
                        {transaction.paymentType || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transaction ID</span>
                      <span className="font-mono">
                        {transaction.transactionId || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>
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
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">Subscription</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Plan</span>
                        <span className="font-semibold capitalize">
                          {transaction.subscription.plan}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span
                          className={`font-semibold ${
                            transaction.subscription.status === "active"
                              ? "text-green-600"
                              : "text-yellow-600"
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

            <div className="mt-6 flex gap-3">
              <Button
                onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions`)}
                variant="outline"
                className="flex-1"
              >
                Back to Subscriptions
              </Button>
              {status === "success" && (
                <Button
                  onClick={() => router.push(`/dashboard/${tenantSlug}`)}
                  className="flex-1"
                >
                  Go to Dashboard
                </Button>
              )}
              {(status === "failed" || status === "pending") && (
                <Button
                  onClick={() => router.push(`/dashboard/${tenantSlug}/subscriptions/checkout`)}
                  className="flex-1"
                >
                  Try Again
                </Button>
              )}
            </div>

            {status === "pending" && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Some payment methods (like bank transfers) may take longer
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
            className="text-muted-foreground"
          >
            ← Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}