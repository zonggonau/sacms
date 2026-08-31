"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Crown, Eye, EyeOff, CheckCircle2, Mail, RefreshCw } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useToast } from "@/hooks/use-toast"
import { registerUser, resendVerificationAction } from "@/actions/auth"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "free"
  const redirectTo = searchParams.get("redirect_to") || ""
  
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [checkingUsers, setCheckingUsers] = useState(true)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const { data: session, status } = useSession()

  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  })

  const getPasswordStrength = (p: string) => {
    let score = 0
    if (p.length >= 8) score += 1
    if (/\d/.test(p)) score += 1
    if (/[!@#$%^&*(),.?":{}|<>]/.test(p)) score += 1
    if (/[A-Z]/.test(p)) score += 1
    return score
  }

  const strength = getPasswordStrength(formData.password)
  const strengthLabels = ["Sangat Lemah", "Lemah", "Sedang", "Kuat", "Sangat Kuat"]
  const strengthColors = ["bg-red-500", "bg-red-500", "bg-yellow-500", "bg-emerald-400", "bg-emerald-600"]

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

  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const response = await fetch("/api/auth/check-first-user")
        const data = await response.json()
        setIsFirstUser(data.isFirstUser)
      } catch (error) {
        console.error("Error checking first user:", error)
      } finally {
        setCheckingUsers(false)
      }
    }
    checkFirstUser()
  }, [])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleResendEmail = async () => {
    if (resendCooldown > 0 || resending || !formData.email) return
    setResending(true)
    try {
      const res = await resendVerificationAction(formData.email)
      if (res.error) {
        toast({ title: "Gagal Mengirim", description: res.error, variant: "destructive" })
      } else {
        toast({ title: "Email Terkirim!", description: res.message || "Tautan aktivasi baru telah dikirim ke email Anda." })
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
    
    if (!formData.agreeTerms) {
      toast({ title: "Perhatian", description: "Anda harus menyetujui syarat & ketentuan layanan", variant: "destructive" })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Perhatian", description: "Konfirmasi kata sandi tidak cocok dengan kata sandi", variant: "destructive" })
      return
    }

    if (strength < 3) {
      toast({ title: "Perhatian", description: "Kata sandi terlalu lemah. Pastikan minimal berstatus 'Kuat'.", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const response = await registerUser({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        plan: plan,
      })

      if (response.error) {
        throw new Error(response.error)
      }

      if (response.autoVerified) {
        toast({
          title: "Pendaftaran Berhasil",
          description: response.message || "Akun Anda berhasil dibuat. Silakan masuk.",
        })
        const loginUrl = `/login?email=${encodeURIComponent(formData.email)}${redirectTo ? '&redirect_to=' + encodeURIComponent(redirectTo) : '&redirect_to=/dashboard'}`
        router.push(loginUrl)
      } else {
        setIsSuccess(true)
        setResendCooldown(60)
      }
    } catch (error: any) {
      toast({
        title: "Pendaftaran Gagal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan saat memproses pendaftaran.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loginHref = redirectTo 
    ? `/login?redirect_to=${encodeURIComponent(redirectTo)}` 
    : `/login${formData.email ? '?email=' + encodeURIComponent(formData.email) : ''}`

  if (checkingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 py-8 relative overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl opacity-50" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent blur-3xl opacity-50" />
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
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-1">Buat Akun Baru</h1>
            <p className="text-xs sm:text-sm font-medium text-muted-foreground text-center">
              {isFirstUser ? "Inisialisasi akun Super Admin SaCMS" : "Mulai bangun dan kelola konten digital dengan SaCMS"}
            </p>
          </div>

          {isFirstUser && !isSuccess && (
            <div className="mb-6 p-3.5 rounded-xl border border-orange-500/30 bg-orange-500/10 flex items-center gap-3 backdrop-blur-sm">
              <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-xs font-bold text-orange-500">Super Administrator</p>
                <p className="text-[11px] text-orange-500/80 font-medium leading-tight">Anda adalah pengguna pertama yang mendaftar di sistem ini.</p>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-4 py-2">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3 shadow-inner shadow-primary/20 text-primary">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black tracking-tight">Pendaftaran Berhasil!</h3>
              <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-4 leading-relaxed">
                Tautan aktivasi telah dikirimkan ke <strong className="text-foreground">{formData.email}</strong>. 
                Silakan cek kotak masuk atau folder spam email Anda untuk mengaktifkan akun.
              </p>

              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-2 mb-4">
                <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
                  <Mail className="w-4 h-4 text-primary" /> Belum menerima email?
                </div>
                <p className="text-[11px]">Email mungkin butuh 1-2 menit untuk sampai atau masuk ke tab Spam/Promosi.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendEmail}
                  disabled={resending || resendCooldown > 0}
                  className="w-full text-xs font-bold rounded-lg mt-1 h-9 cursor-pointer"
                >
                  {resending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {resendCooldown > 0 ? `Kirim Ulang Email (${resendCooldown}s)` : "Kirim Ulang Email Aktivasi"}
                </Button>
              </div>

              <Link href={loginHref} className="block pt-2">
                <Button className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] text-xs cursor-pointer">
                  Masuk ke Halaman Login
                </Button>
              </Link>
            </div>
          ) : (

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-bold text-foreground/80">Nama Lengkap</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="John Doe" 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  required 
                  className="h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 text-xs transition-all" 
                />
              </div>

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
                <Label htmlFor="password" className="text-xs font-bold text-foreground/80">Kata Sandi</Label>
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
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                      <div
                        className={`h-full transition-all duration-500 ease-out ${strengthColors[strength]}`}
                        style={{ width: `${(strength === 0 ? 1 : strength) * 25}%` }}
                      />
                    </div>
                    <p className={`text-[10px] font-bold tracking-wide uppercase ${strength < 2 ? "text-red-500" : strength < 3 ? "text-yellow-500" : "text-emerald-500"}`}>
                      {strengthLabels[strength]}
                    </p>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Min. 8 karakter, 1 angka, 1 huruf besar, & 1 simbol khusus.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-bold text-foreground/80">Konfirmasi Kata Sandi</Label>
                <div className="relative">
                  <Input 
                    id="confirmPassword" 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••" 
                    value={formData.confirmPassword} 
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} 
                    required 
                    className="h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 pr-11 text-xs transition-all" 
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                    aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2.5 pt-2">
                <Checkbox 
                  id="terms" 
                  checked={formData.agreeTerms} 
                  onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })} 
                  className="border-border/50 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary w-4 h-4" 
                />
                <Label htmlFor="terms" className="text-xs font-medium text-muted-foreground cursor-pointer select-none">
                  Saya menyetujui <span className="text-primary font-bold">Syarat & Ketentuan Layanan</span>
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 mt-5 text-xs cursor-pointer" 
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Daftar Sekarang
              </Button>
            </form>
          )}

          {!isSuccess && (
            <div className="mt-8 text-center text-xs font-medium text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href={loginHref} className="text-primary font-bold hover:underline">
                Masuk di sini
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
