# Vercel Sandbox: lifecycle, previews, failure modes

`src/lib/ai-site/sandbox.ts` keeps one **persistent**, named Sandbox per project — `Sandbox.getOrCreate({ name, persistent: true, image: 'vercel/sandbox/node:24', ports: [3000], timeout: 30min, resources: { vcpus: 2 } })` from `@vercel/sandbox`. The name is `sacms-${sha256(tenantId + ':' + projectId)}`, hashing *both* ids (not just `projectId`) so a sandbox is attributable per tenant, not just per project.

## The call chain

- `prepareSandbox(tenantDb, tenantId, tenantSlug, projectId)` — per-project-locked (see below): `getSandbox()` → `syncFiles()` (push every `AiSiteFile` row into the Sandbox, delete anything removed since the last sync, via a `.sacms/manifest.json` diff) → `writeFrontendEnv()` (see `references/sdk-and-templates.md`) → `installDependencies()` (hash `package.json`, skip `npm install` if unchanged).
- `ensurePreview(tenantDb, tenantId, tenantSlug, projectId)` — `prepareSandbox()`, then (also per-project-locked) starts `next dev` detached only if nothing already answers port 3000, polls until it does (90s timeout), extends the Sandbox's own timeout, and returns `sandbox.domain(3000)`.
- `runSandboxCommand(tenantDb, tenantId, tenantSlug, projectId, command, args)` — `prepareSandbox()` then runs the one command, truncated output.
- `deleteProjectSandbox(tenantId, projectId)` — stops and deletes the Sandbox; called from the project `DELETE` route.

All three "do work" functions take the same four leading args (`tenantDb, tenantId, tenantSlug, projectId`) — if you add a fourth caller, match that signature rather than inventing a fifth variant.

## Concurrency

`setupLocks` (an in-memory `Map<projectId, Promise>`) serializes `prepareSandbox`/`ensurePreview` calls **per project within this one server process** — so the preview pane's poll and an in-flight agent `runCommand` for the same project queue instead of racing `npm install`. This is explicitly **not** safe across multiple app instances behind a load balancer: two instances could still race the same project's sandbox. Inherited as-is from the reference implementation; fine for the current single-instance deployment, flag for explicit sign-off if horizontal scaling of the app server is ever introduced.

## Credentials and failure modes

- `getVercelToken()` (`src/lib/vercel-client.ts`): Settings-DB first, then `VERCEL_ACCESS_TOKEN`/`VERCEL_API_TOKEN` env (same DB-wins-over-env rule as the Gateway key — see `references/architecture.md`). Plus plain `VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` env reads, or nothing at all when `VERCEL_OIDC_TOKEN`/`VERCEL` env vars indicate the app itself is running on Vercel.
- Missing any of token/team/project (and not running on Vercel) → `SandboxConfigError` with an actionable message, surfaced as a 503 by the preview route.
- **A `403 Not authorized` / `invalidToken: true` from Vercel's API on *any* endpoint — even `/v2/user`, which needs no special scope — means the token itself is dead, full stop.** Confirmed by direct `curl` against `/v2/user` with the configured token during this session: same error as the Sandbox call. Don't spend time hypothesizing a Sandbox-specific permission gap before ruling this out with that one cheap call.
- "The database is already in sync with the Prisma schema" / a push that reports success but changed nothing is the signature of a *different*, already-fixed class of bug (schema pushed to the wrong DB because only `DATABASE_URL` was overridden, not `DIRECT_URL` — see memory `tenant-db-transaction-array-bug`), not a Sandbox issue; don't confuse the two when debugging "it says it worked but nothing changed."

## What's NOT verified live (see `references/security.md`'s own NOT TESTED section too)

Everything above was read from source, not exercised against a real Sandbox with real credentials in this session (the configured Vercel token was dead for part of the session and its replacement wasn't re-verified end-to-end through a full generation turn). Before trusting this in front of a user, someone needs to actually: create a project → send a message → watch tool calls happen → confirm files land in `AiSiteFile` → confirm the preview pane shows a real, working iframe → send a follow-up → confirm the preview updates. That's the one gap no amount of source-reading closes.
