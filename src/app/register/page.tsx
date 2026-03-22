"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Database, Loader2, Eye, EyeOff, Crown, Building2, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [checkingUsers, setCheckingUsers] = useState(true)
  const [isFirstUser, setIsFirstUser] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    tenantName: "",
    tenantSlug: "",
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

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.agreeTerms) {
      toast({ title: "Error", description: "You must agree to the terms and conditions", variant: "destructive" })
      return
    }

    if (!isFirstUser && !formData.tenantName) {
      toast({ title: "Error", description: "Please fill in workspace name", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      // Use explicit slug if provided, otherwise generate from name
      const slug = formData.tenantSlug || generateSlug(formData.tenantName)
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          ...(formData.tenantName ? { tenantName: formData.tenantName } : {}),
          ...(slug ? { tenantSlug: slug } : {}),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Registration failed")
      }

      toast({
        title: "Success!",
        description: data.isFirstUser 
          ? "Super Admin account created. Please sign in."
          : "Account created. Please sign in.",
      })

      router.push("/login")
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-emerald-600 to-teal-700 p-12 flex-col justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent)]" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SaCMS</span>
          </Link>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-3xl font-bold text-white leading-tight">
            Start building in minutes
          </h2>
          <p className="text-white/70 text-sm leading-relaxed max-w-sm">
            Create your workspace and start defining content schemas. 
            Your APIs are auto-generated instantly.
          </p>
          <div className="space-y-2.5">
            {[
              "Multi-tenant workspaces with team roles",
              "REST + GraphQL with advanced filtering",
              "Content workflow & scheduled publishing",
              "TypeScript SDK with auto-generated types",
              "Cloud media storage via Cloudflare R2",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-white/80 text-sm">
                <Check className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/50">
          &copy; {new Date().getFullYear()} ContentFlow. All rights reserved.
        </p>
      </div>

      {/* Right Form Panel */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">ContentFlow</span>
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold">Create your account</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isFirstUser ? "Set up your Super Admin account" : "Get started with your free workspace"}
            </p>
          </div>

          {isFirstUser && (
            <div className="mb-5 p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-purple-700 dark:text-purple-300">First User — Super Admin</p>
                  <p className="text-xs text-muted-foreground">Full platform management access</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" type="text" placeholder="John Doe" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="h-10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@company.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="h-10" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} className="h-10 pr-10" />
                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {!isFirstUser && (
              <div className="pt-3 border-t space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Your Workspace</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenantName">Workspace Name</Label>
                  <Input
                    id="tenantName" type="text" placeholder="My Company"
                    value={formData.tenantName}
                    onChange={(e) => {
                      const name = e.target.value
                      setFormData({ 
                        ...formData, 
                        tenantName: name,
                        tenantSlug: generateSlug(name) // Auto-update slug
                      })
                    }}
                    required className="h-10"
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    A unique URL slug will be generated automatically for you.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start space-x-2">
              <Checkbox id="terms" checked={formData.agreeTerms} onCheckedChange={(checked) => setFormData({ ...formData, agreeTerms: checked as boolean })} className="mt-0.5" />
              <Label htmlFor="terms" className="text-xs font-normal leading-relaxed">
                I agree to the <Link href="#" className="text-emerald-600 hover:underline">Terms of Service</Link> and <Link href="#" className="text-emerald-600 hover:underline">Privacy Policy</Link>
              </Label>
            </div>

            <Button type="submit" className="w-full h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isFirstUser ? "Create Super Admin Account" : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
