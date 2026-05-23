"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Database, Loader2, Eye, EyeOff } from "lucide-react"
import { useSearchParams } from "next/navigation"

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
        toast({
          title: "Error",
          description: "Invalid email or password",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "Welcome",
        description: "Successfully signed in.",
      })

      const sessionRes = await fetch("/api/auth/session")
      const sessionData = await sessionRes.json()
      const user = sessionData?.user

      if (user?.role === "super_admin") {
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
        title: "Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Database className="w-6 h-6 text-orange-500" />
            <span className="text-xl font-bold">SaCMS</span>
          </Link>
          <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
          <p className="text-sm text-muted-foreground">Enter your email and password</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              className="h-10 border-border focus-visible:ring-1 focus-visible:ring-orange-500 rounded-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Link href="/forgot-password" className="text-xs text-orange-500 hover:underline">
                Forgot password?
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
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none transition-none mt-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign in"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-orange-500 hover:underline">
            Register here
          </Link>
        </div>
      </div>
    </div>
  )
}
