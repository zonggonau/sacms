"use client"

import React, { useState, useRef, useTransition } from "react"
import { useSession } from "next-auth/react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Loader2, Save, User as UserIcon, Mail, Shield, Key, 
  Sparkles, Camera, Trash2, Upload, CheckCircle2, Copy, Check, Lock
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { updateProfileAction } from "@/actions/profile"

interface ProfileModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userRole?: string
}

export function ProfileModal({ open, onOpenChange, userRole }: ProfileModalProps) {
  const { data: session, update } = useSession()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isPending, startTransition] = useTransition()
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [copiedId, setCopiedId] = useState(false)

  const [name, setName] = useState(session?.user?.name || "")
  const [imageUrl, setImageUrl] = useState<string | null>(session?.user?.image || null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Keep state synchronized when session loads or dialog opens
  React.useEffect(() => {
    if (open && session?.user) {
      setName(session.user.name || "")
      setImageUrl(session.user.image || null)
      setPassword("")
      setConfirmPassword("")
    }
  }, [open, session?.user?.name, session?.user?.image])

  const email = session?.user?.email || ""
  const userId = session?.user?.id || ""
  const displayRole = userRole || (session?.user?.role === "super_admin" ? "super_admin" : session?.user?.role || "owner")
  const plan = (session?.user as any)?.plan || "free"

  const handleCopyId = () => {
    if (!userId) return
    navigator.clipboard.writeText(userId)
    setCopiedId(true)
    toast({ title: "User ID Tersalin", description: "ID akun Anda berhasil disalin ke clipboard." })
    setTimeout(() => setCopiedId(false), 2000)
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "Format Tidak Didukung",
        description: "Harap pilih file gambar (JPG, PNG, WEBP, atau GIF).",
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Ukuran Terlalu Besar",
        description: "Maksimal ukuran foto adalah 5MB.",
      })
      return
    }

    setIsUploadingPhoto(true)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        setImageUrl(data.url)
        await update({ image: data.url })
        toast({
          title: "Foto Profil Berhasil Diperbarui",
          description: "Foto profil Anda telah disimpan.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Mengupload Foto",
          description: data.error || "Terjadi kesalahan saat mengupload gambar.",
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Gagal Mengupload",
        description: "Terjadi kesalahan koneksi saat mengupload foto.",
      })
    } finally {
      setIsUploadingPhoto(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true)
    try {
      const res = await fetch("/api/user/avatar", {
        method: "DELETE",
      })
      if (res.ok) {
        setImageUrl(null)
        await update({ image: null })
        toast({
          title: "Foto Profil Dihapus",
          description: "Foto profil Anda telah dikembalikan ke inisial default.",
        })
      } else {
        toast({
          variant: "destructive",
          title: "Gagal Menghapus Foto",
          description: "Terjadi kesalahan saat menghapus foto profil.",
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Terjadi Kesalahan",
        description: "Gagal menghapus foto profil.",
      })
    } finally {
      setIsUploadingPhoto(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password) {
      if (password.length < 6) {
        toast({
          title: "Password Terlalu Pendek",
          description: "Password baru harus memiliki minimal 6 karakter.",
          variant: "destructive",
        })
        return
      }
      if (password !== confirmPassword) {
        toast({
          title: "Konfirmasi Password Tidak Cocok",
          description: "Password baru dan konfirmasi password tidak sama.",
          variant: "destructive",
        })
        return
      }
    }

    startTransition(async () => {
      try {
        const result = await updateProfileAction({
          name: name.trim() || undefined,
          password: password || undefined,
          image: imageUrl,
        })

        if (result.success) {
          if (result.user?.name) {
            await update({ name: result.user.name, image: imageUrl })
          }
          setPassword("")
          setConfirmPassword("")
          toast({
            title: "Profil Berhasil Disimpan",
            description: "Perubahan data profil Anda telah tersimpan.",
          })
          onOpenChange(false)
        } else {
          toast({
            title: "Gagal Menyimpan",
            description: result.error || "Gagal memperbarui data profil.",
            variant: "destructive",
          })
        }
      } catch (error) {
        toast({
          title: "Terjadi Kesalahan",
          description: "Terjadi kesalahan saat menyimpan profil.",
          variant: "destructive",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden border border-border bg-card shadow-2xl rounded-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="sr-only">
          <DialogTitle>Edit Profil Pengguna</DialogTitle>
          <DialogDescription>Kelola data diri, foto avatar, dan keamanan akun Anda.</DialogDescription>
        </DialogHeader>

        {/* Header Visual Banner */}
        <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-purple-500/10 p-6 pb-5 border-b border-border/50 pr-12 shrink-0">
          <div className="flex items-center gap-4">
            {/* Avatar & Photo Upload Trigger */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-md shadow-primary/20 border-2 border-background">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name || "User Avatar"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{name?.[0]?.toUpperCase() || email?.[0]?.toUpperCase() || "U"}</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                title="Ganti Foto Profil"
                className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer disabled:opacity-50"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-foreground truncate leading-tight">
                  {name || "Pengguna SaCMS"}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{email}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge
                  variant={displayRole === "super_admin" ? "default" : "secondary"}
                  className={
                    displayRole === "super_admin"
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[10px] uppercase font-bold border-0"
                      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] uppercase font-bold border-0"
                  }
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {displayRole.replace("_", " ")}
                </Badge>
                {plan && (
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-background/60 border-border">
                    <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                    Paket: {plan}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Quick Photo Actions */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              className="h-7 text-[11px] font-semibold rounded-lg bg-background/80 hover:bg-background border-border/70 cursor-pointer"
            >
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload className="w-3 h-3 mr-1.5" />
                  Upload Foto
                </>
              )}
            </Button>
            {imageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemovePhoto}
                disabled={isUploadingPhoto}
                className="h-7 text-[11px] font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3 h-3 mr-1.5" />
                Hapus Foto
              </Button>
            )}
          </div>
        </div>

        {/* Form Body with Tabs */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-4">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="bg-muted/40 border border-border/80 p-1 rounded-xl w-full grid grid-cols-2">
              <TabsTrigger value="general" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                <UserIcon className="w-3.5 h-3.5 mr-1.5" />
                Data Profil
              </TabsTrigger>
              <TabsTrigger value="security" className="rounded-lg font-bold text-xs py-1.5 cursor-pointer">
                <Lock className="w-3.5 h-3.5 mr-1.5" />
                Keamanan & Password
              </TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="mt-4 space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <UserIcon className="h-3.5 w-3.5 text-primary" /> Nama Lengkap
                </Label>
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama lengkap Anda"
                  required
                  className="h-9 bg-background border-border rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-email" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-primary" /> Alamat Email
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={email}
                  disabled
                  className="h-9 bg-muted/40 text-muted-foreground border-border/50 rounded-xl cursor-not-allowed text-xs"
                />
                <p className="text-[11px] text-muted-foreground">Email terverifikasi terhubung dengan sesi login Anda.</p>
              </div>

              {userId && (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">User Account ID</p>
                    <p className="text-xs font-mono text-foreground truncate mt-0.5">{userId}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyId}
                    className="h-7 px-2.5 text-[11px] rounded-lg shrink-0 cursor-pointer"
                  >
                    {copiedId ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
                    {copiedId ? "Tersalin" : "Salin"}
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security" className="mt-4 space-y-3.5">
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs text-muted-foreground space-y-1">
                <p className="font-bold text-foreground">Perbarui Kata Sandi Akun</p>
                <p className="text-[11px]">Kosongkan bidang ini jika Anda tidak ingin mengubah kata sandi akun saat ini.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-new-password" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-primary" /> Password Baru
                </Label>
                <Input
                  id="profile-new-password"
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 bg-background border-border rounded-xl text-xs"
                  minLength={6}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="profile-confirm-password" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-primary" /> Konfirmasi Password Baru
                </Label>
                <Input
                  id="profile-confirm-password"
                  type="password"
                  placeholder="Ulangi password baru Anda"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-9 bg-background border-border rounded-xl text-xs"
                  minLength={6}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="pt-3 border-t border-border/50 gap-2 sm:gap-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending || isUploadingPhoto}
              className="rounded-xl border-border h-9 text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isPending || isUploadingPhoto}
              className="rounded-xl bg-primary text-primary-foreground font-bold h-9 px-4 text-xs shadow-xs hover:bg-primary/90 ml-2 cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Simpan Perubahan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
