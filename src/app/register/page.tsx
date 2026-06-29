"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Crown, Eye, EyeOff, CheckCircle2 } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useToast } from "@/hooks/use-toast"
import { registerUser } from "@/app/actions/auth"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "free"
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
  const strengthColors = ["bg-red-500", "bg-red-500", "bg-yellow-500", "bg-green-400", "bg-green-600"]

  // Redirect if already logged in
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const user = session.user as any
      const redirectTo = searchParams.get("redirect_to") || ""
      if (redirectTo) {
        router.push(redirectTo)
      } else if (user?.role === "super_admin") {
        router.push("/admin")
      } else if (user?.role === "admin") {
        router.push("/dashboard")
      } else {
        const isOwnerOrAdmin = user?.tenants?.some((t: any) => t.role === "owner" || t.role === "admin")
        
        if (isOwnerOrAdmin) {
          router.push("/dashboard")
        } else if (user?.tenants && user.tenants.length > 0) {
          router.push(`/dashboard/${user.tenants[0].slug}/cms`)
        } else {
          router.push("/dashboard")
        }
      }
    }
  }, [status, session, router, searchParams])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.agreeTerms) {
      toast({ title: "Perhatian", description: "Anda harus menyetujui syarat & ketentuan", variant: "destructive" })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Perhatian", description: "Password tidak cocok", variant: "destructive" })
      return
    }

    if (strength < 3) {
      toast({ title: "Perhatian", description: "Password terlalu lemah. Minimal harus 'Kuat'.", variant: "destructive" })
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

      if (response.isFirstUser) {
        toast({
          title: "Sukses",
          description: "Akun Super Admin berhasil dibuat. Silakan masuk.",
        })
        router.push(`/login?email=${formData.email}&redirect_to=/dashboard/setup`)
      } else {
        setIsSuccess(true)
      }
    } catch (error: any) {
      toast({
        title: "Gagal Mendaftar",
        description: error instanceof Error ? error.message : "Registrasi gagal dilakukan",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (checkingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 py-12 relative overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl opacity-50" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center mb-10">
            <Link href="/" className="inline-block mb-8">
              <Logo iconSize="lg" showText={true} useOrange={true} />
            </Link>
            <h1 className="text-3xl font-black tracking-tight mb-2">Buat Akun</h1>
            <p className="text-sm font-medium text-muted-foreground text-center">
              {isFirstUser ? "Inisialisasi platform Anda" : "Bergabung dengan SaCMS hari ini"}
            </p>
          </div>

          {isFirstUser && !isSuccess && (
            <div className="mb-8 p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 flex items-center gap-4 backdrop-blur-sm">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-orange-500">Super Admin</p>
                <p className="text-xs text-orange-500/80 font-medium">Anda adalah pengguna pertama di sistem ini.</p>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center space-y-4 py-4">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner shadow-primary/20">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">Registrasi Berhasil!</h3>
              <p className="text-sm font-medium text-muted-foreground mb-8 leading-relaxed">
                Satu langkah lagi. Kami telah mengirimkan tautan aktivasi ke <strong>{formData.email}</strong>. 
                Silakan cek kotak masuk atau folder spam email Anda.
              </p>
              <Link href="/login">
                <Button className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105">
                  Kembali ke Halaman Masuk
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-bold text-foreground/80">Nama Lengkap</Label>
              <Input 
                id="name" 
                type="text" 
                placeholder="John Doe" 
                value={formData.name} 
                onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                required 
                className="h-12 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 transition-all" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-bold text-foreground/80">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nama@email.com" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                required 
                className="h-12 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 transition-all" 
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-bold text-foreground/80">Password</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={formData.password} 
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                  required 
                  className="h-12 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 pr-12 transition-all" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {formData.password && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className={`h-full transition-all duration-500 ease-out ${strengthColors[strength]}`}
                      style={{ width: `${(strength === 0 ? 1 : strength) * 25}%` }}
                    />
                  </div>
                  <p className={`text-[11px] font-bold tracking-wide uppercase ${strength < 2 ? "text-red-500" : strength < 3 ? "text-yellow-500" : "text-green-500"}`}>
                    {strengthLabels[strength]}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground font-medium mt-1">Min. 8 karakter, 1 angka, 1 simbol khusus.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-bold text-foreground/80">Konfirmasi Password</Label>
              <div className="relative">
                <Input 
                  id="confirmPassword" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={formData.confirmPassword} 
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} 
                  required 
                  className="h-12 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary rounded-xl px-4 pr-12 transition-all" 
                />
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-4">
              <Checkbox 
                id="terms" 
                checked={formData.agreeTerms} 
                onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })} 
                className="border-border/50 rounded-md data-[state=checked]:bg-primary data-[state=checked]:border-primary w-5 h-5" 
              />
              <Label htmlFor="terms" className="text-sm font-medium text-muted-foreground cursor-pointer">
                Saya menyetujui <Link href="#" className="text-primary font-bold hover:underline">Syarat & Ketentuan</Link>
              </Label>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 mt-6" 
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Daftar Sekarang"}
            </Button>
            </form>
          )}

          {!isSuccess && (
            <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Masuk di sini
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
