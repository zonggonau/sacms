import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshWorkspacePage } from "@/components/dashboard/refresh-workspace-page"
import { getWorkspaceMonitoring } from "@/lib/workspace-operations"

const formatInteger = new Intl.NumberFormat("id-ID")
const formatDecimal = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 })

function formatDuration(duration: number | null) {
  return duration === null ? "Belum tersedia" : formatDecimal.format(duration) + " ms"
}

function formatRatio(count: number, total: number) {
  return total > 0 ? formatDecimal.format(100 * count / total) + "%" : "Belum tersedia"
}

function Metrics({ title, rows }: { title: string; rows: [string, string | number][] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        <dl className="divide-y divide-border/70">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1 py-2">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">{typeof value === "number" ? formatInteger.format(value) : value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}

export default async function SystemMonitoringPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  const { tenant } = await params
  const access = await getTenantAccess(session, tenant)
  if (!access) redirect("/dashboard")

  const metrics = await getWorkspaceMonitoring(access.tenantId).catch((error) => {
    console.error("[workspace monitoring]", error)
    return null
  })

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Monitoring Workspace</h1>
          <p className="text-sm text-muted-foreground">Aktivitas yang tercatat dalam 24 jam terakhir.</p>
        </div>
        <RefreshWorkspacePage />
      </header>
      {metrics ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Metrics title="API" rows={[
            ["Permintaan tercatat", metrics.api.total],
            ["Respons HTTP 4xx dan 5xx", formatRatio(metrics.api.errors, metrics.api.total)],
            ["Latensi rata-rata", formatDuration(metrics.api.averageMs)],
            ["Latensi p95", formatDuration(metrics.api.p95Ms)],
          ]} />
          <Metrics title="Webhook" rows={[
            ["Upaya pengiriman", metrics.webhooks.total],
            ["Pengiriman berhasil", metrics.webhooks.success],
            ["Pengiriman gagal", metrics.webhooks.total - metrics.webhooks.success],
            ["Tingkat keberhasilan", formatRatio(metrics.webhooks.success, metrics.webhooks.total)],
            ["Durasi rata-rata", formatDuration(metrics.webhooks.averageMs)],
          ]} />
          <Metrics title="Konten" rows={[
            ["Total entri aktif", metrics.content.entries],
            ["Entri baru dalam 24 jam", metrics.content.createdEntries],
            ["Entri terbit dalam 24 jam", metrics.content.publishedEntries],
          ]} />
          <Metrics title="Pencarian" rows={[["Telemetri pencarian", "Belum tersedia"]]} />
        </div>
      ) : (
        <p role="alert" className="rounded-lg border p-4 text-sm">Gagal memuat metrik workspace. Gunakan Muat ulang untuk mencoba lagi.</p>
      )}
    </section>
  )
}
