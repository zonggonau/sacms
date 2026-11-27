import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { getTenantAccess } from "@/lib/tenant-access"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RefreshWorkspacePage } from "@/components/dashboard/refresh-workspace-page"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getWorkspaceJobs } from "@/lib/workspace-operations"

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
})

function displayDate(time: Date | null) {
  return time ? dateFormat.format(time) + " UTC" : "—"
}

const retryLabels: Record<string, string> = {
  pending: "Dalam antrean",
  retrying: "Percobaan ulang",
  exhausted: "Batas percobaan tercapai",
}

export default async function SystemJobsPage({ params }: { params: Promise<{ tenant: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")
  const { tenant } = await params
  const access = await getTenantAccess(session, tenant)
  if (!access) redirect("/dashboard")
  if (!["owner", "admin"].includes(access.role)) redirect("/dashboard/" + encodeURIComponent(tenant))

  const jobs = await getWorkspaceJobs(access.tenantId).catch((error) => {
    console.error("[workspace jobs]", error)
    return null
  })

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Jobs Workspace</h1>
          <p className="text-sm text-muted-foreground">Jadwal publikasi dan antrean pengiriman webhook.</p>
        </div>
        <RefreshWorkspacePage />
      </header>
      {jobs ? (
        <>
          <Card>
            <CardHeader><CardTitle>Publikasi terjadwal ({jobs.scheduledTotal})</CardTitle></CardHeader>
            <CardContent>
              {jobs.scheduled.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Koleksi</TableHead>
                    <TableHead>Waktu terjadwal</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {jobs.scheduled.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.contentType.name}</TableCell>
                        <TableCell>{displayDate(entry.scheduledAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">Belum ada entri yang dijadwalkan.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Antrean webhook ({jobs.retryTotal})</CardTitle></CardHeader>
            <CardContent>
              {jobs.retries.length > 0 ? (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Webhook</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Percobaan</TableHead>
                    <TableHead>Jadwal ulang</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {jobs.retries.map((retry) => (
                      <TableRow key={retry.id}>
                        <TableCell>{retry.webhook.name}</TableCell>
                        <TableCell>{retry.event}</TableCell>
                        <TableCell><Badge variant={retry.status === "exhausted" ? "destructive" : "secondary"}>{retryLabels[retry.status]}</Badge></TableCell>
                        <TableCell>{retry.attempts} / {retry.maxAttempts}</TableCell>
                        <TableCell>{displayDate(retry.nextRetryAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : <p className="text-sm text-muted-foreground">Antrean pengiriman ulang kosong.</p>}
            </CardContent>
          </Card>
        </>
      ) : (
        <p role="alert" className="rounded-lg border p-4 text-sm">Gagal memuat antrean workspace. Gunakan Muat ulang untuk mencoba lagi.</p>
      )}
    </section>
  )
}
