"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Database, Loader2, Mail } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { forgotPassword } from "@/app/actions/auth"

export default function ForgotPasswordPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await forgotPassword(email)

      if (response.error) {
        throw new Error(response.error)
      }

      setIsSent(true)
      toast({
        title: "Link Sent",
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border p-8">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <Database className="w-6 h-6 text-orange-500" />
            <span className="text-xl font-bold">SaCMS</span>
          </Link>
          <h1 className="text-2xl font-semibold mb-1">Forgot Password</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your email and we'll send you a link to reset your password.
          </p>
        </div>

        {isSent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-medium">Check your email</h3>
            <p className="text-sm text-muted-foreground mb-6">
              If an account with {email} exists, an email will be sent with further instructions.
            </p>
            <Button
              variant="outline"
              className="w-full h-10 rounded-none transition-none"
              onClick={() => setIsSent(false)}
            >
              Try another email
            </Button>
            <div className="mt-4">
              <Link href="/login" className="text-sm text-orange-500 hover:underline">
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-10 border-border focus-visible:ring-1 focus-visible:ring-orange-500 rounded-none"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white rounded-none transition-none mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
            </Button>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link href="/login" className="text-orange-500 hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
