# Vercel Sandbox: lifecycle, previews, failure modes

`src/lib/ai-site/sandbox.ts` keeps one **persistent**, named Sandbox per project — `Sandbox.getOrCreate({ name, persistent: true, image: 'vercel/sandbox/node:24', ports: [3000], timeout: 30min, resources: { vcpus: 2 } })` from `@vercel/sandbox`. The name is `sacms-${sha256(tenantId + ':' + projectId)}`, hashing *both* ids (not just `projectId`) so a sandbox is attributable per tenant, not just per project.

## The call chain

- `prepareSandbox(tenantDb, tenantId, tenantSlug, projectId)` — per-project-locked (see below): `getSandbox()` → `syncFiles()` (push every `AiSiteFile` row into the Sandbox, delete anything removed since the last sync, via a `.sacms/manifest.json` diff) → `writeFrontendEnv()` (see `references/sdk-and-templates.md`) → `installDependencies()` (hash `package.json`, skip `npm install` if unchanged).
- `ensurePreview(tenantDb, tenantId, tenantSlug, projectId)` — `prepareSandbox()`, then (also per-project-locked) starts `next dev` detached only if nothing already answers port 3000, polls until it does (90s timeout), extends the Sandbox's own timeout, and returns `sandbox.domain(3000)`.
- `runSandboxCommand(tenantDb, tenantId, tenantSlug, projectId, command, args)` — `prepareSandbox()` then runs the one command, truncated output.
- `deleteProjectSandbox(tenantId, projectId)` — stops and deletes the Sandbox; called from the project `DELETE` route.

All three "do work" functions take the same four leading args (`tenantDb, tenantId, tenantSlug, projectId`) — if you add a fourth caller, match that signature rather than inventing a fifth variant.

## Concurrency

`withProjectLock` serializes `prepareSandbox`/`ensurePreview` calls per project so the preview pane's poll and an in-flight agent `runCommand` don't race `npm install`. Redis-backed (Upstash, via `getRedis()`) when configured — a real cross-instance spinlock (`SET NX EX` + poll, 600s TTL as a crashed-holder safety net), so two app instances behind a load balancer can't race the same project's sandbox. Falls back to the original in-memory per-process `Map<projectId, Promise>` queue when Redis isn't configured — same single-instance-only guarantee as before. If Redis is ever removed as a hard dependency, re-check this still degrades sanely.

## Credentials and failure modes

- `getVercelToken()`/`getVercelTeamId()`/`getVercelProjectId()` (`src/lib/vercel-client.ts`): all three resolve Settings-DB first, then fall back to `.env` (`VERCEL_ACCESS_TOKEN`/`VERCEL_API_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID` respectively — same DB-wins-over-env rule as the Gateway key, see `references/architecture.md`), configurable from Admin > Settings > Integrasi Deploy (Vercel) exactly like the token always was. Before this, `sandbox.ts`'s `credentials()` read team/project straight from `process.env`, so a value set only in Admin Settings was silently ignored for Sandbox previews even though the token itself already worked that way — fixed so all three resolve identically. Or nothing at all when `VERCEL_OIDC_TOKEN`/`VERCEL` env vars indicate the app itself is running on Vercel.
- Missing any of token/team/project (and not running on Vercel) → `SandboxConfigError` with an actionable message, surfaced as a 503 by the preview route.
- **A `403 Not authorized` / `invalidToken: true` from Vercel's API on *any* endpoint — even `/v2/user`, which needs no special scope — means the token itself is dead, full stop.** Confirmed by direct `curl` against `/v2/user` with the configured token during this session: same error as the Sandbox call. Don't spend time hypothesizing a Sandbox-specific permission gap before ruling this out with that one cheap call.
- "The database is already in sync with the Prisma schema" / a push that reports success but changed nothing is the signature of a *different*, already-fixed class of bug (schema pushed to the wrong DB because only `DATABASE_URL` was overridden, not `DIRECT_URL` — see memory `tenant-db-transaction-array-bug`), not a Sandbox issue; don't confuse the two when debugging "it says it worked but nothing changed."

## Publishing to production — a completely separate path from the Sandbox

The Sandbox above is **only** for the live preview iframe — temporary compute, torn down/resumed independently of anything real. "Publish" (the button in `ChatWorkspace`'s header, `POST .../ai-site/projects/[projectId]/publish`) is a different code path entirely: it reads the project's `AiSiteFile` rows and deploys them through `src/lib/infrastructure/deploy-frontend.ts`'s `deployTenantFrontend()` straight to Vercel's real Deployments API (`deployToVercel` in `vercel-client.ts`, `target: "production"`), **not** through the Sandbox.

This was a deliberate choice over wiring AI Site to an external platform (the user floated routing generation through Lovable's own MCP server — rejected: OAuth-only and Business/Enterprise-gated, so it can't be driven server-side per-tenant without a human login loop, double-bills the user for both SaCMS and Lovable credits, and deploys land on `lovable.app`, not a domain SaCMS controls). The dashboard's own one-click-deploy (`ai-builder/deploy` route, used outside AI Site for a tenant's non-AI-Site frontend) already did 100% of what "publish" needs — `deployTenantFrontend` is that same logic, extracted so both callers share it instead of AI Site reinventing a second deploy path.

**Why this matters for anything else you build here**: because `deployTenantFrontend` always deploys to the same Vercel project name (`sacms-<tenantSlug>`) regardless of caller, AI Site's "Publish" and the dashboard's own deploy button are *the same destination* — whichever one a tenant used most recently is what's live, and the existing domain-management UI at `/dashboard/[tenant]/infrastructure` (add/verify a custom domain, DNS records) already works for an AI-Site-published site with zero AI-Site-specific domain code. Don't build a separate domain UI inside AI Site; link to that page instead, like the publish result dialog already does.

**Not yet exercised live**: `publish` has gone through `tsc`/`lint`/`test`/`build` but not an actual real deploy with real Vercel credentials in a browser — same caveat as the Sandbox preview below.

## What's NOT verified live (see `references/security.md`'s own NOT TESTED section too)

Everything above was read from source, not exercised against a real Sandbox with real credentials in this session (the configured Vercel token was dead for part of the session and its replacement wasn't re-verified end-to-end through a full generation turn). Before trusting this in front of a user, someone needs to actually: create a project → send a message → watch tool calls happen → confirm files land in `AiSiteFile` → confirm the preview pane shows a real, working iframe → send a follow-up → confirm the preview updates. That's the one gap no amount of source-reading closes.
