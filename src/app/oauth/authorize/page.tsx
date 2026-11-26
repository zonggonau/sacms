import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { findClient } from "@/lib/mcp/oauth/service"
import { isValidCodeChallenge, mcpResource, parseMcpResource, publicOrigin } from "@/lib/mcp/oauth/protocol"
import { ConsentForm } from "./consent-form"

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? ""
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border/80 bg-card p-6 shadow-xs space-y-2">
        <h1 className="text-base font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground">{message}</p>
      </div>
    </main>
  )
}

/**
 * Consent screen for connecting an MCP client (ChatGPT, Grok, Claude.ai) to one
 * workspace. A bad client_id or redirect_uri is shown here and never redirected,
 * because redirecting to an unregistered URI would leak the code.
 */
export default async function OAuthAuthorizePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const clientId = first(params.client_id)
  const redirectUri = first(params.redirect_uri)
  const state = first(params.state)
  const responseType = first(params.response_type)
  const codeChallenge = first(params.code_challenge)
  const codeChallengeMethod = first(params.code_challenge_method)
  const resource = first(params.resource)

  const client = await findClient(clientId)
  if (!client) {
    return <ErrorCard title="Klien tidak dikenal" message="Aplikasi yang meminta akses tidak terdaftar di SaCMS. Mulai ulang penyambungan dari aplikasi tersebut." />
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return <ErrorCard title="Alamat balik tidak cocok" message="Alamat tujuan setelah persetujuan tidak terdaftar untuk aplikasi ini. Demi keamanan, akses dibatalkan." />
  }

  const origin = publicOrigin()
  const named = resource ? parseMcpResource(origin, resource) : { workspaceSlug: null }
  const lockedSlug = named?.workspaceSlug ?? null
  const problem =
    responseType !== "code" ? "Permintaan harus memakai response_type=code."
    : codeChallengeMethod !== "S256" || !isValidCodeChallenge(codeChallenge) ? "Permintaan harus memakai PKCE dengan S256."
    : resource && !named ? "Permintaan menunjuk server lain selain MCP SaCMS ini."
    : null
  if (problem) {
    const url = new URL(redirectUri)
    url.searchParams.set("error", "invalid_request")
    url.searchParams.set("error_description", problem)
    if (state) url.searchParams.set("state", state)
    redirect(url.toString())
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    const back = `/oauth/authorize?${new URLSearchParams(
      Object.entries(params).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v[0] : v] as [string, string]])),
    ).toString()}`
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`)
  }

  const memberships = await db.tenantMember.findMany({
    where: { userId: session.user.id, role: { in: ["owner", "admin"] } },
    select: { tenant: { select: { slug: true, name: true, status: true } } },
    orderBy: { joinedAt: "asc" },
  })
  const allWorkspaces = memberships
    .map((m) => m.tenant)
    .filter((t) => t.status !== "deleting")
    .map((t) => ({ slug: t.slug, name: t.name }))

  // Connecting through a workspace's own URL: show only that workspace. If the
  // user is not its owner or admin, say so here instead of offering a choice.
  const workspaces = lockedSlug ? allWorkspaces.filter((w) => w.slug === lockedSlug) : allWorkspaces
  if (lockedSlug && workspaces.length === 0) {
    return <ErrorCard title="Anda tidak bisa menyambungkan workspace ini" message={`Workspace "${lockedSlug}" tidak ditemukan untuk akun Anda, atau Anda bukan owner atau admin-nya. Minta owner workspace menyambungkan aplikasinya.`} />
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <ConsentForm
        clientName={client.name}
        redirectHost={new URL(redirectUri).host}
        workspaces={workspaces}
        locked={lockedSlug !== null}
        request={{
          client_id: clientId,
          redirect_uri: redirectUri,
          state,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          resource: mcpResource(origin, lockedSlug ?? undefined),
        }}
      />
    </main>
  )
}
