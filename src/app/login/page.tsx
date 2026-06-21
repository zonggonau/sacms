"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  })

  // Check if this is the first user (no users in system)
  useEffect(() => {
    const checkFirstUser = async () => {
      try {
        const res = await fetch("/api/auth/check-first-user")
        const data = await res.json()
        if (data.isFirstUser) {
          router.push("/register")
        }
      } catch (err) {
        console.error("Error checking first user:", err)
      }
    }
    checkFirstUser()
  }, [router])

  // Handle redirects from email verification
  useEffect(() => {
    if (searchParams.get("verified") === "true") {
      toast({
        title: "Email Verified",
        description: "Your email has been successfully verified. You can now log in.",
      })
      // Clear URL params
      router.replace("/login")
    }
    
    const errorParam = searchParams.get("error")
    if (errorParam === "MissingToken" || errorParam === "InvalidToken") {
      toast({ variant: "destructive", title: "Verification Failed", description: "The verification link is invalid or missing." })
      router.replace("/login")
    } else if (errorParam === "TokenExpired") {
      toast({ variant: "destructive", title: "Link Expired", description: "The verification link has expired. Please register again or request a new link." })
      router.replace("/login")
    }
  }, [searchParams, router, toast])

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
        // NextAuth returns "CredentialsSignin" when authorization fails with `return null`
        const errorMessage = result.error === "CredentialsSignin" 
          ? "Email atau password tidak valid" 
          : result.error;
          
        toast({
          title: "Akses Ditolak",
          description: errorMessage,
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Selamat Datang",
        description: "Berhasil masuk ke sistem.",
      })

      const sessionRes = await fetch("/api/auth/session")
      const sessionData = await sessionRes.json()
      const user = sessionData?.user

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
          router.push(`/cms/${user.tenants[0].slug}`)
        } else {
          router.push("/dashboard")
        }
      }
      
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Terjadi Kesalahan",
        description: error.message || "Kesalahan sistem tidak terduga.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 relative overflow-hidden">
      {/* Background Blurs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl opacity-50" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-primary/5">
          <div className="flex flex-col items-center mb-10">
            <Link href="/" className="inline-block mb-8">
              <Logo iconSize="lg" showText={true} useOrange={true} />
            </Link>
            <h1 className="text-3xl font-black tracking-tight mb-2">Selamat Datang</h1>
            <p className="text-sm font-medium text-muted-foreground text-center">
              Masuk ke akun Anda untuk melanjutkan
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-bold text-foreground/80">Password</Label>
                <Link href="/forgot-password" className="text-xs font-bold text-primary hover:text-primary/80 transition-colors">
                  Lupa password?
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
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white rounded-full font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 mt-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Masuk ke Sistem"}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-muted-foreground">
            Belum punya akun?{" "}
            <Link href="/register" className="text-primary font-bold hover:underline">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
