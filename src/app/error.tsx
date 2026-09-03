"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import {
  AlertCircle, RefreshCcw, Home,
  ChevronLeft, ShieldAlert, Bug
} from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)
    console.error("Error Boundary caught:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 w-full">
      <div className="max-w-md w-full space-y-8 text-center">
        {/* Error Icon */}
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-[2rem] bg-destructive/10 flex items-center justify-center animate-pulse">
            <Bug className="h-12 w-12 text-destructive" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-card border-4 border-background flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
        </div>

        {/* Error Content */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-foreground tracking-tight uppercase">System Hiccup</h1>
          <p className="text-muted-foreground font-medium leading-relaxed">
            Something went wrong while processing this page. Don't worry, our engineers have been notified.
          </p>
        </div>

        {/* Error Detail (Optional for Dev) */}
        <div className="p-4 rounded-2xl bg-muted/50 border border-border text-left space-y-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">Error Trace ID</span>
          </div>
          <p className="text-xs font-mono text-destructive break-all">
            {error.digest || "ERR_INTERNAL_EXCEPTION"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => reset()}
            className="h-12 rounded-2xl font-black uppercase tracking-widest shadow-lg"
          >
            <RefreshCcw className="mr-2 h-5 w-5" /> Try Again
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="h-11 rounded-xl font-bold"
            >
              <ChevronLeft className="mr-2 h-4 w-4" /> Go Back
            </Button>
            <Button
              variant="outline"
              asChild
              className="h-11 rounded-xl font-bold"
            >
              <a href="/"><Home className="mr-2 h-4 w-4" /> Return Home</a>
            </Button>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
          SaCMS Enterprise Resilience Mode
        </p>
      </div>
    </div>
  )
}
