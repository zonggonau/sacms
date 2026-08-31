"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function CmsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[CMS Error]", error)
  }, [error])

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full min-h-[50vh] p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 mb-5">
        <AlertTriangle className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-black tracking-tight mb-2">Gagal Memuat CMS</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-2">
        Terjadi kesalahan saat memuat halaman content manager.
      </p>
      {error?.message && (
        <code className="text-xs text-rose-500 bg-rose-500/5 border border-rose-500/20 rounded-lg px-3 py-1.5 mb-6 max-w-sm truncate block">
          {error.message}
        </code>
      )}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => reset()}
          className="rounded-xl bg-primary hover:bg-primary/90 font-bold px-6 text-sm"
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" />
          Coba Lagi
        </Button>
        <Button variant="outline" asChild className="rounded-xl font-bold px-6 text-sm">
          <Link href="..">
            <ArrowLeft className="mr-2 h-3.5 w-3.5" />
            Kembali
          </Link>
        </Button>
      </div>
    </div>
  )
}
