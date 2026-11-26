"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface ConsentFormProps {
  clientName: string
  redirectHost: string
  workspaces: { slug: string; name: string }[]
  /** True when the client connected through one workspace's own URL: no choice is offered. */
  locked?: boolean
  request: {
    client_id: string
    redirect_uri: string
    state: string
    code_challenge: string
    code_challenge_method: string
    resource: string
  }
}

export function ConsentForm({ clientName, redirectHost, workspaces, locked = false, request }: ConsentFormProps) {
  const [tenantSlug, setTenantSlug] = useState(workspaces[0]?.slug ?? "")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (decision: "approve" | "deny") => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/oauth/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, tenant_slug: tenantSlug, decision }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.redirect) {
        setError(data.error || "Persetujuan gagal. Coba lagi.")
        setBusy(false)
        return
      }
      window.location.assign(data.redirect)
    } catch {
      setError("Jaringan bermasalah. Coba lagi.")
      setBusy(false)
    }
  }

  if (workspaces.length === 0) {
    return (
      <div className="max-w-md w-full rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-2">
        <h1 className="text-base font-bold text-foreground">Tidak ada workspace yang bisa disambungkan</h1>
        <p className="text-xs text-muted-foreground">
          Hanya owner dan admin workspace yang bisa menyambungkan aplikasi. Minta owner workspace menyambungkannya, atau masuk dengan akun yang berperan sebagai owner atau admin.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-md w-full rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-5">
      <div className="space-y-1">
        <h1 className="text-base font-bold text-foreground">
          {locked && workspaces[0] ? `Izinkan ${clientName} mengakses workspace ${workspaces[0].name}?` : `Izinkan ${clientName} mengakses workspace SaCMS?`}
        </h1>
        <p className="text-xs text-muted-foreground">
          Aplikasi ini akan dapat membaca dan mengubah schema, konten, dan website workspace yang Anda pilih. Akses bisa dicabut kapan saja di <strong>Developer → MCP</strong>.
        </p>
        <p className="text-[11px] text-muted-foreground">Setelah disetujui, browser akan dikirim ke <span className="font-mono">{redirectHost}</span>.</p>
      </div>

      {locked && workspaces[0] ? (
        <div className="space-y-1.5">
          <p className="text-xs font-bold text-foreground">Workspace</p>
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
            <p className="text-xs font-bold text-foreground">{workspaces[0].name}</p>
            <p className="text-[11px] font-mono text-muted-foreground">{workspaces[0].slug}</p>
          </div>
          <p className="text-[11px] text-muted-foreground">Koneksi ini hanya untuk workspace di atas. Tidak bisa dialihkan ke workspace lain.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <label htmlFor="workspace" className="text-xs font-bold text-foreground">Workspace</label>
          <select
            id="workspace"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            className="w-full h-9 rounded-xl border border-border/80 bg-background px-3 text-xs"
          >
            {workspaces.map((w) => (
              <option key={w.slug} value={w.slug}>{w.name} ({w.slug})</option>
            ))}
          </select>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" disabled={busy} onClick={() => send("deny")} className="rounded-xl text-xs font-bold h-9">
          Tolak
        </Button>
        <Button disabled={busy || !tenantSlug} onClick={() => send("approve")} className="rounded-xl text-xs font-bold h-9">
          {busy ? "Memproses…" : "Izinkan"}
        </Button>
      </div>
    </div>
  )
}
