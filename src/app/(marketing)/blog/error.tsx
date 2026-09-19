"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Blog Error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-5">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-black tracking-tight mb-2">Gagal Memuat Blog</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Konten blog tidak dapat dimuat saat ini. Silakan coba lagi beberapa saat.
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => reset()}
          className="rounded-xl font-bold px-6 text-sm"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Coba Lagi
        </Button>
        <Button variant="outline" asChild className="rounded-xl font-bold px-6 text-sm">
          <Link href="/">
            <Home className="mr-2 h-3.5 w-3.5" />
            Beranda
          </Link>
        </Button>
      </div>
    </div>
  )
}
