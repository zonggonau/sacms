"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useToast } from "@/hooks/use-toast"
import { resetPassword } from "@/actions/auth"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!token) {
      toast({ title: "Perhatian", description: "Token reset kata sandi tidak ditemukan", variant: "destructive" })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Perhatian", description: "Konfirmasi kata sandi tidak cocok", variant: "destructive" })
      return
    }

    if (strength < 3) {
      toast({ title: "Perhatian", description: "Kata sandi terlalu lemah. Minimal harus 'Kuat'.", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const response = await resetPassword({ 
        token,
        password: formData.password 
      })

      if (response.error) {
        throw new Error(response.error)
      }

      setIsSuccess(true)
      toast({
        title: "Berhasil",
        description: response.message || "Kata sandi Anda berhasil diperbarui.",
      })
    } catch (error: any) {
      toast({
        title: "Terjadi Kesalahan",
        description: error.message || "Terjadi kesalahan saat mengatur ulang kata sandi",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4 text-emerald-500">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold">Kata Sandi Berhasil Diperbarui</h3>
        <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
          Kata sandi Anda telah berhasil diubah. Silakan masuk menggunakan kata sandi baru Anda.
        </p>
        <Link href="/login">
          <Button className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs">
            Masuk ke Akun
          </Button>
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <h3 className="text-base font-bold text-destructive">Tautan Tidak Valid</h3>
        <p className="text-xs text-muted-foreground mb-6">
          Tautan reset kata sandi tidak valid atau telah kadaluarsa. Silakan ajukan tautan baru.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full h-9 rounded-xl text-xs font-semibold">
            Minta Tautan Baru
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-xs font-semibold">Kata Sandi Baru</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            className="h-9 text-xs border-border/80 rounded-xl pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {formData.password && (
            <div className="mt-2 space-y-1">
              <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all duration-300 ${strengthColors[strength]}`}
                  style={{ width: `${(strength === 0 ? 1 : strength) * 25}%` }}
                />
              </div>
              <p className={`text-[10px] font-medium ${strength < 2 ? "text-red-500" : strength < 3 ? "text-yellow-600" : "text-green-600"}`}>
                {strengthLabels[strength]}
              </p>
            </div>
          )}
        <p className="text-[10px] text-muted-foreground mt-1">Min. 8 karakter, kombinasi huruf & angka.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword" className="text-xs font-semibold">Konfirmasi Kata Sandi Baru</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            className="h-9 text-xs border-border/80 rounded-xl pr-10"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs mt-4"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atur Ulang Kata Sandi"}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl p-8 shadow-xs">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Logo iconSize="md" showText={true} useOrange={true} />
          </Link>
          <h1 className="text-2xl font-bold mb-1">Buat Kata Sandi Baru</h1>
          <p className="text-xs text-muted-foreground text-center">
            Buat kata sandi yang aman untuk akun Anda
          </p>
        </div>

        <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
