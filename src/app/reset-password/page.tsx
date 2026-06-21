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
import { resetPassword } from "@/app/actions/auth"

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
      toast({ title: "Error", description: "Missing reset token", variant: "destructive" })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" })
      return
    }

    if (strength < 3) {
      toast({ title: "Error", description: "Password is too weak. Must be 'Kuat' or 'Sangat Kuat'.", variant: "destructive" })
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
        title: "Success",
        description: response.message,
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        </div>
        <h3 className="text-lg font-medium">Password Reset Successfully</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Your password has been changed. You can now log in with your new password.
        </p>
        <Link href="/login">
          <Button className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none transition-none">
            Go to Login
          </Button>
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <h3 className="text-lg font-medium text-destructive">Invalid Link</h3>
        <p className="text-sm text-muted-foreground mb-6">
          The password reset link is missing or invalid. Please request a new one.
        </p>
        <Link href="/forgot-password">
          <Button variant="outline" className="w-full h-10 rounded-none transition-none">
            Request New Link
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            className="h-10 border-border focus-visible:ring-1 focus-visible:ring-orange-500 rounded-none pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
        <p className="text-[10px] text-muted-foreground mt-1">Min. 8 characters, 1 number, 1 symbol.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={formData.confirmPassword}
            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            required
            className="h-10 border-border focus-visible:ring-1 focus-visible:ring-orange-500 rounded-none pr-10"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none transition-none mt-4"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reset Password"}
      </Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Logo iconSize="md" showText={true} useOrange={true} />
          </Link>
          <h1 className="text-2xl font-semibold mb-1">Set New Password</h1>
          <p className="text-sm text-muted-foreground">
            Create a strong password for your account
          </p>
        </div>

        <Suspense fallback={<div className="flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
