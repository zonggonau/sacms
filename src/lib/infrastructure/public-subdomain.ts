import "server-only"
import { randomBytes } from "crypto"
import { db } from "@/lib/database"

const TOKEN_LENGTH_BYTES = 8 // -> 16 hex characters

function generateToken(): string {
  return randomBytes(TOKEN_LENGTH_BYTES).toString("hex")
}

/**
 * Lazily generates and persists a random 16-hex-character identifier for a
 * tenant's public `*.sites.sacms.cloud` subdomain label — decoupled from
 * `Tenant.slug` (which can be long/descriptive, e.g. "profil-dinas-
 * pemberdayaan-perempuan-...") so `<label>.sites.sacms.cloud`'s SSL
 * certificate Common Name never risks exceeding the issuer's 64-character
 * limit (confirmed live: a long slug-based demo subdomain failed cert
 * issuance outright with "The common name is longer than 64 characters").
 *
 * Idempotent — returns the already-persisted token on every later call
 * instead of generating a new one, so the public URL stays stable across
 * redeploys/self-heal checks. ONLY call this at tenant creation (real
 * tenants) or from the demo-deploy self-heal path (demo tenants, which have
 * nothing external to break) — never from an ordinary deploy of an EXISTING
 * tenant, which must keep reading the already-stored value (falling back to
 * `tenant.slug` when null) rather than opportunistically generating one, so
 * a tenant created before this field existed never has its public URL
 * silently change underneath it.
 */
export async function ensurePublicSubdomainToken(tenantId: string): Promise<string> {
  const existing = await db.tenant.findUnique({ where: { id: tenantId }, select: { publicSubdomainToken: true } })
  if (existing?.publicSubdomainToken) return existing.publicSubdomainToken

  // Collision odds at 64 bits of randomness are astronomically low — this
  // loop is defense in depth, not a real expectation of ever looping (see
  // Tenant.publicSubdomainToken's own comment on why there's no DB-level
  // unique constraint to enforce this instead).
  let token = generateToken()
  for (let attempt = 0; attempt < 5; attempt++) {
    const collision = await db.tenant.findFirst({ where: { publicSubdomainToken: token }, select: { id: true } })
    if (!collision) break
    token = generateToken()
  }

  await db.tenant.update({ where: { id: tenantId }, data: { publicSubdomainToken: token } })
  return token
}
