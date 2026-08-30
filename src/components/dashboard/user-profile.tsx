"use client"

import { useState, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, User as UserIcon, Mail, Shield, Key } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateProfileAction } from "@/actions/profile"

interface UserProfileProps {
  initialData?: {
    name: string
    email: string
    role: string
  }
}

export function UserProfile({ initialData }: UserProfileProps) {
  const { update } = useSession()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(initialData?.name || "")
  const [email, setEmail] = useState(initialData?.email || "")
  const [role, setRole] = useState(initialData?.role || "user")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password && password !== confirmPassword) {
      toast({
        title: "Perhatian",
        description: "Konfirmasi kata sandi tidak cocok.",
        variant: "destructive"
      })
      return
    }

    startTransition(async () => {
      try {
        const result = await updateProfileAction({
          name,
          password: password || undefined
        })

        if (result.success) {
          await update({ name: result.user?.name }) // Update NextAuth session
          setPassword("")
          setConfirmPassword("")
          toast({
            title: "Profil Diperbarui",
            description: "Profil Anda telah berhasil diperbarui.",
          })
        } else {
          toast({
            title: "Gagal Memperbarui",
            description: result.error || "Gagal memperbarui profil.",
            variant: "destructive"
          })
        }
      } catch (error) {
        toast({
          title: "Terjadi Kesalahan",
          description: "Terjadi kesalahan yang tidak terduga.",
          variant: "destructive"
        })
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Profil Saya</h1>
        <p className="text-muted-foreground mt-2 text-sm">Kelola informasi pribadi dan pengaturan keamanan akun Anda.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="md:col-span-1">
          <Card className="rounded-2xl border-border/80">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shadow-md mb-4">
                  {name?.[0]?.toUpperCase() ?? "U"}
                </div>
                <h3 className="text-lg font-bold">{name}</h3>
                <p className="text-xs text-muted-foreground">{email}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold capitalize">
                  <Shield className="h-3.5 w-3.5" />
                  {role}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSave}>
            <Card className="rounded-2xl border-border/80">
              <CardHeader>
                <CardTitle className="text-base font-bold">Informasi Pribadi</CardTitle>
                <CardDescription className="text-xs">Perbarui rincian profil dasar akun Anda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-2 text-xs font-semibold">
                    <UserIcon className="h-3.5 w-3.5 text-muted-foreground" /> Nama Lengkap
                  </Label>
                  <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="Masukkan nama lengkap" 
                    required 
                    className="h-9 text-xs rounded-xl border-border/80"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="flex items-center gap-2 text-xs font-semibold">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Alamat Email
                  </Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    disabled 
                    className="h-9 text-xs rounded-xl bg-muted/50 text-muted-foreground border-border/80" 
                  />
                  <p className="text-[10px] text-muted-foreground">Alamat email saat ini tidak dapat diubah secara langsung.</p>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60">
                  <h4 className="text-xs font-bold flex items-center gap-2 mb-4">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" /> Ubah Kata Sandi
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-password" className="text-xs font-semibold">Kata Sandi Baru</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder="Kosongkan jika tidak diubah" 
                        className="h-9 text-xs rounded-xl border-border/80"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="confirm-password" className="text-xs font-semibold">Konfirmasi Kata Sandi</Label>
                      <Input 
                        id="confirm-password" 
                        type="password" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Konfirmasi kata sandi baru" 
                        className="h-9 text-xs rounded-xl border-border/80"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 flex justify-end border-t border-border/60 p-4">
                <Button type="submit" disabled={saving} className="h-9 text-xs font-bold rounded-xl shadow-xs">
                  {saving ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-3.5 w-3.5" />
                  )}
                  Simpan Perubahan
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  )
}
