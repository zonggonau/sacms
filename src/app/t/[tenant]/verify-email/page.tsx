"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Logo } from "@/components/ui/logo"

/**
 * Minimal SaCMS-hosted fallback for the member email-verification link.
 *
 * Headless tenants normally set `memberEmailConfirmationRedirect` to their own
 * frontend, and the verification email points there instead. This page only
 * runs when that isn't configured: it POSTs the `?code=` to the tenant's member
 * API and shows the outcome.
 */
function VerifyEmailInner() {
  const params = useParams<{ tenant: string }>()
  const search = useSearchParams()
  const code = search.get("code")
  const tenant = params?.tenant
  const [state, setState] = useState<"working" | "done" | "error">("working")
  const [message, setMessage] = useState("")
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    if (!code || !tenant) {
      setState("error")
      setMessage("Tautan ini tidak memiliki kode konfirmasi.")
      return
    }

    fetch(`/api/public/${encodeURIComponent(tenant)}/auth/email-confirmation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (res.ok) {
          setState("done")
          setMessage("Alamat email Anda telah dikonfirmasi. Anda bisa menutup tab ini dan masuk kembali.")
        } else {
          setState("error")
          setMessage(data.error || "Tautan konfirmasi ini tidak valid atau sudah kedaluwarsa.")
        }
      })
      .catch(() => {
        setState("error")
        setMessage("Tidak dapat menghubungi server. Silakan coba lagi sesaat lagi.")
      })
  }, [code, tenant])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        {state === "working" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mengonfirmasi alamat email Anda…</p>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-lg font-black tracking-tight text-foreground">Email terkonfirmasi</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="text-lg font-black tracking-tight text-foreground">Konfirmasi gagal</h1>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  )
}
