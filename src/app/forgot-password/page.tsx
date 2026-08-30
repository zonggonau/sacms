"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Mail } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { useToast } from "@/hooks/use-toast"
import { forgotPassword } from "@/actions/auth"

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
        title: "Tautan Terkirim",
        description: response.message || "Tautan reset kata sandi telah dikirim ke email Anda.",
      })
    } catch (error: any) {
      toast({
        title: "Terjadi Kesalahan",
        description: error.message || "Terjadi kesalahan saat memproses permintaan.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-md bg-card border border-border/80 rounded-2xl p-8 shadow-xs">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <Logo iconSize="md" showText={true} showDetail={true} useOrange={true} />
          </Link>
          <h1 className="text-xl font-bold mb-1">Lupa Kata Sandi</h1>
          <p className="text-xs text-muted-foreground text-center">
            Masukkan email Anda dan kami akan mengirimkan tautan untuk mengatur ulang kata sandi Anda.
          </p>
        </div>

        {isSent ? (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-4 text-primary">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold">Periksa Email Anda</h3>
            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
              Jika akun dengan alamat <span className="font-semibold text-foreground">{email}</span> terdaftar, email berisi petunjuk telah dikirim.
            </p>
            <Button
              variant="outline"
              className="w-full h-9 rounded-xl text-xs font-semibold"
              onClick={() => setIsSent(false)}
            >
              Gunakan email lain
            </Button>
            <div className="mt-4">
              <Link href="/login" className="text-xs font-semibold text-primary hover:underline">
                &larr; Kembali ke halaman masuk
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">Alamat Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-9 text-xs rounded-xl border-border/80"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs mt-4"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Kirim Tautan Reset"}
            </Button>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Ingat kata sandi Anda?{" "}
              <Link href="/login" className="text-primary font-semibold hover:underline">
                Masuk sekarang
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
