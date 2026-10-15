import type { Metadata } from "next"
import { ShieldAlert } from "lucide-react"
import { Logo } from "@/components/ui/logo"

// Deliberately a plain server component — no "use client", no useSession —
// so it keeps rendering even while proxy.ts's lockout also blocks /api/auth.
// Shown for both an expired and a revoked license; never say which, to keep
// the message generic for the institution's own end users.
export const metadata: Metadata = {
  title: "Lisensi Tidak Aktif — SaCMS",
  robots: { index: false, follow: false },
}

export default function LicenseExpiredPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <div className="space-y-1.5">
          <h1 className="text-lg font-black tracking-tight text-foreground">Lisensi Tidak Aktif</h1>
          <p className="text-sm text-muted-foreground">
            Lisensi untuk instalasi ini sudah tidak aktif. Hubungi tim SaCMS untuk memperpanjang akses.
          </p>
        </div>
      </div>
    </div>
  )
}
