import { Metadata } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getTenantDb } from "@/lib/database"
import { SuratClient } from "./surat-client"
import { SubscriptionGate } from "../../subscription-gate"

export const metadata: Metadata = {
  title: "Surat Plugin | SaCMS",
}

export default async function SuratAddonPage({
  params,
}: {
  params: { tenant: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const tenantDb = await getTenantDb(params.tenant)
  
  // Ambil templates jika sudah ada (opsional, bisa diambil via client-side nanti)
  const templates = [
    { id: "srt-1", name: "Surat Keterangan Kerja", format: "PDF" },
    { id: "srt-2", name: "Surat Peringatan", format: "DOCX" },
    { id: "srt-3", name: "Invoice", format: "PDF" }
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] p-8">
      <div className="flex-1 space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Format Surat Plugin</h2>
          <p className="text-muted-foreground">
            Generate dokumen resmi secara otomatis berdasarkan data konten CMS.
          </p>
        </div>
        
        {/* Mengamankan halaman ini dengan pengecekan subscription addon */}
        <SubscriptionGate isExpired={false} tenantId={params.tenant}>
          <SuratClient tenantSlug={params.tenant} initialTemplates={templates} />
        </SubscriptionGate>
      </div>
    </div>
  )
}
