import Link from "next/link"
import { MailCheck, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Logo } from "@/components/ui/logo"
import { getEffectiveRegistrationMode } from "@/lib/registration-policy"
import { RegisterForm } from "./register-form"

// The registration mode is changed at runtime from /admin/settings, so this
// page must never be prerendered with whatever mode the build happened to see.
export const dynamic = "force-dynamic"

const NOTICE = {
  invite_only: {
    icon: MailCheck,
    title: "Pendaftaran Sementara Melalui Undangan",
    body: "Untuk sementara, akun baru hanya bisa dibuat lewat undangan. Minta admin workspace Anda menambahkan email Anda sebagai anggota tim, lalu aktifkan akun dari email undangan yang Anda terima.",
  },
  closed: {
    icon: Lock,
    title: "Pendaftaran Sedang Ditutup",
    body: "Pendaftaran akun baru untuk sementara ditutup. Jika Anda sudah punya akun, silakan masuk seperti biasa.",
  },
} as const

export default async function RegisterPage() {
  const mode = await getEffectiveRegistrationMode().catch(() => "open" as const)
  if (mode === "open") return <RegisterForm />

  const { icon: Icon, title, body } = NOTICE[mode]
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground px-4 py-8 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent blur-3xl opacity-50" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/20 via-transparent to-transparent blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card/40 backdrop-blur-2xl border border-border/50 rounded-[2rem] p-8 sm:p-10 shadow-2xl shadow-primary/5 text-center">
          <Link href="/" className="inline-block mb-6">
            <Logo iconSize="lg" showText={true} showDetail={true} useOrange={true} />
          </Link>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mb-2">{title}</h1>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-relaxed">{body}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-2.5 justify-center">
            <Button asChild className="rounded-xl font-bold">
              <Link href="/login">Masuk</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-bold">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
