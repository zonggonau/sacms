"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { signIn, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Mail, RefreshCw } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useToast } from "@/hooks/use-toast"
import { resendVerificationAction } from "@/actions/auth"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { data: session, status } = useSession()
  
  const initialEmail = searchParams.get("email") || ""
  const redirectTo = searchParams.get("redirect_to") || ""

  const [formData, setFormData] = useState({
    email: initialEmail,
    password: "",
  })


  // Update email if query param changes
  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (emailParam) {
      setFormData((prev) => ({ ...prev, email: emailParam }))
    }
  }, [searchParams])

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const user = session.user as any
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        const userTenants = user?.tenants || []
        const hasAdminTenant = userTenants.some((t: any) => t.role === "admin" || t.role === "owner")
        const isSuperAdminOwnerOrAdmin = user?.role === "super_admin" || user?.role === "owner" || user?.role === "admin" || hasAdminTenant
        
        if (isSuperAdminOwnerOrAdmin) {
          router.push("/dashboard")
        } else if (userTenants.length > 0) {
          router.push(`/dashboard/${userTenants[0].slug || userTenants[0].id}/cms`)
        } else {
          router.push("/dashboard")
        }
      }
    }
  }, [status, session, router, redirectTo])

  // Check if this is the first user (no users in system)
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const res = await fetch("/api/auth/check-first-user")
        const data = await res.json()
        if (data.isFirstUser) {
          router.push(redirectTo ? `/register?redirect_to=${encodeURIComponent(redirectTo)}` : "/register")
        }
      } catch (err) {
        console.error("Error checking first user:", err)
      }
    }
    checkFirstUser()
  }, [router, redirectTo])

  // Handle redirects from email verification
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast({
        title: "Email Terverifikasi",
        description: "Email Anda telah berhasil diverifikasi. Silakan masuk.",
      })
      router.replace(redirectTo ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` : "/login")
    }
    
    const errorParam = searchParams.get("error")
    if (errorParam === "MissingToken" || errorParam === "InvalidToken") {
      toast({ variant: "destructive", title: "Verifikasi Gagal", description: "Tautan verifikasi tidak valid atau tidak ditemukan." })
      router.replace(redirectTo ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` : "/login")
    } else if (errorParam === "TokenExpired") {
      toast({ variant: "destructive", title: "Tautan Kadaluarsa", description: "Tautan verifikasi telah kadaluarsa. Silakan daftar kembali atau minta tautan baru." })
      router.replace(redirectTo ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` : "/login")
    }
  }, [searchParams, router, toast, redirectTo])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendActivation = async () => {
    const targetEmail = unverifiedEmail || formData.email
    if (!targetEmail || resending || resendCooldown > 0) return
    setResending(true)
    try {
      const res = await resendVerificationAction(targetEmail)
      if (res.error) {
        toast({ title: "Gagal Mengirim", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Email Terkirim!", description: res.message || "Tautan aktivasi baru telah dikirim." })
        setResendCooldown(60)
      }
    } catch (err: any) {
      toast({ title: "Gagal Mengirim", description: err.message || "Terjadi kesalahan sistem.", variant: "destructive" })
    } finally {
      setResending(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        let errorMessage = result.error
        let errorTitle = "Akses Ditolak"

        if (result.error === "CredentialsSignin") {
          errorMessage = "Email atau kata sandi tidak valid. Silakan periksa kembali."
        } else if (result.error.toLowerCase().includes("aktivasi") || result.error.toLowerCase().includes("verifikasi") || result.error.toLowerCase().includes("belum aktif")) {
          errorTitle = "Aktivasi Akun Diperlukan"
          setUnverifiedEmail(formData.email)
        }
          
        toast({
          title: errorTitle,
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Selamat Datang",
        description: "Berhasil masuk ke akun Anda.",
      })

      const sessionRes = await fetch("/api/auth/session")
      const sessionData = await sessionRes.json()
      const user = sessionData?.user

      let destination = "/dashboard"

      if (redirectTo) {
        destination = redirectTo
      } else {
        const userTenants = user?.tenants || []
        const hasAdminTenant = userTenants.some((t: any) => t.role === "admin" || t.role === "owner")
        const isSuperAdminOwnerOrAdmin = user?.role === "super_admin" || user?.role === "owner" || user?.role === "admin" || hasAdminTenant
        
        if (isSuperAdminOwnerOrAdmin) {
          destination = "/dashboard"
        } else if (userTenants.length > 0) {
          destination = `/dashboard/${userTenants[0].slug || userTenants[0].id}/cms`
        } else {
          destination = "/dashboard"
        }
      }
      
      window.location.href = destination
    } catch (error: any) {
      toast({
        title: "Terjadi Kesalahan",
        description: error.message || "Terjadi kesalahan sistem yang tidak terduga.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const registerHref = redirectTo ? `/register?redirect_to=${encodeURIComponent(redirectTo)}` : "/register"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 relative overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl opacity-50" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center mb-8">
            <Link href="/" className="inline-block mb-4">
              <Logo iconSize="lg" showText={true} showDetail={true} useOrange={true} />
            </Link>
            <div className="inline-flex items-center px-3 py-1 bg-primary/10 border border-primary/20 text-primary text-[11px] font-bold rounded-full mb-3">
              Build smarter. Manage easier. Scale faster.
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-1">Masuk ke Akun</h1>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground text-center">
              Akses workspace dan kelola konten digital Anda
            </p>
          </div>

          {unverifiedEmail && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Akun Anda Belum Aktif</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tautan aktivasi telah dikirim ke <strong>{unverifiedEmail}</strong>. Belum menerima email atau tautan sudah kadaluarsa?
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendActivation}
                disabled={resending || resendCooldown > 0}
                className="w-full text-xs font-bold rounded-xl h-8 mt-1 border-amber-500/30 bg-background/80 hover:bg-amber-500/10"
              >
                {resending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {resendCooldown > 0 ? `Kirim Ulang Link (${resendCooldown}s)` : "Kirim Ulang Link Aktivasi"}
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-foreground/80">Alamat Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 text-xs transition-all"
              />
            </div>


            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-bold text-foreground/80">Kata Sandi</Label>
                <Link href="/forgot-password" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  className="h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 pr-11 text-xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                  aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 mt-5 text-xs cursor-pointer"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Masuk ke Akun
            </Button>
          </form>

          <div className="mt-8 text-center text-xs font-medium text-muted-foreground">
            Belum punya akun?{" "}
            <Link href={registerHref} className="text-primary font-bold hover:underline">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
