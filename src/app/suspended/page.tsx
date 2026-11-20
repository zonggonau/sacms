import type { Metadata } from "next"
import { PauseCircle } from "lucide-react"
import { Logo } from "@/components/ui/logo"

// Deliberately a plain server component — this is what a locked tenant's
// own site VISITORS see (Vercel domain-level redirect from
// <slug>.sites.sacms.cloud or their verified custom domain, see
// setDomainRedirect in src/lib/vercel-client.ts and the enforce-site-lock
// cron), not the tenant's own staff — so the copy stays neutral/generic
// and never mentions billing, plans, or "upgrade" the way the dashboard's
// own SubscriptionGate does.
export const metadata: Metadata = {
  title: "Situs Tidak Tersedia — SaCMS",
  robots: { index: false, follow: false },
}

export default function SuspendedSitePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <PauseCircle className="mx-auto h-10 w-10 text-muted-foreground" />
        <div className="space-y-1.5">
          <h1 className="text-lg font-black tracking-tight text-foreground">Situs Sedang Tidak Tersedia</h1>
          <p className="text-sm text-muted-foreground">
            Situs ini untuk sementara tidak dapat diakses. Jika Anda pemilik situs ini, silakan masuk ke dashboard SaCMS Anda untuk informasi lebih lanjut.
          </p>
        </div>
      </div>
    </div>
  )
}
