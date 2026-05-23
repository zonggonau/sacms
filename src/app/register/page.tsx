"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Database, Loader2, Crown, Eye, EyeOff } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function RegisterPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const plan = searchParams.get("plan") || "free"
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [checkingUsers, setCheckingUsers] = useState(true)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    agreeTerms: false,
  })

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
      toast({ title: "Error", description: "You must agree to the terms", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          plan: plan,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      toast({
        title: "Success",
        description: data.isFirstUser 
          ? "Super Admin account created. Please sign in."
          : "Account created.",
      })

      router.push(`/login?email=${formData.email}`)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Registration failed",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (checkingUsers) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Database className="w-6 h-6 text-orange-500" />
            <span className="text-xl font-bold">SaCMS</span>
          </Link>
          <h1 className="text-2xl font-semibold mb-1">Create Account</h1>
          <p className="text-sm text-muted-foreground">
            {isFirstUser ? "Initialize your platform" : "Join SaCMS today"}
          </p>
        </div>

        {isFirstUser && (
          <div className="mb-6 p-3 border border-orange-200 bg-orange-50 flex items-center gap-3">
            <Crown className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Super Admin</p>
              <p className="text-xs text-orange-600">You are the first user.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
            <Input 
              id="name" 
              type="text" 
              placeholder="John Doe" 
              value={formData.name} 
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
              required 
              className="h-10 border-border focus-visible:ring-1 focus-visible:ring-orange-500 rounded-none" 
            />
          </div>

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
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••" 
                value={formData.password} 
                onChange={(e) => setFormData({ ...formData, password: e.target.value })} 
                required 
                minLength={8} 
                pattern="(?=.*\d)(?=.*[!@#$%^&*(),.?&#34;:{}\|<>]).{8,}"
                title="Must contain at least 8 characters, one number, and one symbol"
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
            <p className="text-[10px] text-muted-foreground mt-1">Min. 8 characters, 1 number, 1 symbol.</p>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox 
              id="terms" 
              checked={formData.agreeTerms} 
              onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })} 
              className="border-border rounded-none data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" 
            />
            <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
              I agree to the <Link href="#" className="text-orange-500 hover:underline">Terms</Link>
            </Label>
          </div>

          <Button 
            type="submit" 
            className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none transition-none mt-4" 
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-orange-500 hover:underline">
            Sign in
          </Link>
        </div>

      </div>
    </div>
  )
}
