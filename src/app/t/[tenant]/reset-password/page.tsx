"use client"

import { Suspense, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/ui/logo"
import { toast } from "sonner"

/**
 * Minimal SaCMS-hosted fallback for the member password-reset link.
 *
 * Headless tenants normally set `memberPasswordResetRedirect` to their own
 * frontend. This page only runs when that isn't configured: it POSTs the
 * `?code=` plus the new password to the tenant's member API.
 */
function ResetInner() {
  const params = useParams<{ tenant: string }>()
  const search = useSearchParams()
  const code = search.get("code")
  const tenant = params?.tenant

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code || !tenant) {
      toast.error("This link is missing its reset code.")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/public/${encodeURIComponent(tenant)}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password, passwordConfirmation: confirm }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDone(true)
      } else {
        toast.error(data.error || "This reset link is invalid or has expired.")
      }
    } catch {
      toast.error("Could not reach the server. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <Logo />
        </div>

        {done ? (
          <div className="text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="text-lg font-black tracking-tight text-foreground">Password updated</h1>
            <p className="text-sm text-muted-foreground">
              Your password has been changed. You can close this tab and sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1 text-center">
              <h1 className="text-lg font-black tracking-tight text-foreground">Choose a new password</h1>
              <p className="text-sm text-muted-foreground">Enter a new password for your account.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function MemberResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <ResetInner />
    </Suspense>
  )
}
