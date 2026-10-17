# The data layer: generated sites run on the real `@sacms/sdk`

This is the piece that makes a generated site professional rather than a demo: it talks to the workspace's real data the same way any production SaCMS integration would, with a typed client, retries, and proper error handling — not a hand-rolled `fetch()` the model improvises per page.

## What `@sacms/sdk` actually is

`mini-services/sdk` is `@sacms/sdk` — a real, **published** npm package (`npm view @sacms/sdk` / the public registry confirms `1.0.0` is live), targeting SaCMS's actual public REST + GraphQL API: `/api/public/[tenant]/content/[contentType]`, `/api/public/[tenant]/content/[contentType]/[id]`, `/api/public/[tenant]/single/[singleType]`, `/api/public/[tenant]/graphql` — all real, currently-serving routes (confirmed by listing `src/app/api/public/[tenant]/` directly, not by trusting the SDK's own README).

`mini-services/sdk/src/client.ts` is the whole implementation:
- `SaCMS` class, constructed with `{ baseUrl, tenant, token, locale? }`.
- `.collection(slug)` → `CollectionClient`: `findMany(params)`, `findOne(id)`, `create({ data, locale?, status? })`, `update(id, params)`, `delete(id)`, plus `.query()` for a fluent builder (`.where(field, op, value)`, `.select([...])`, `.populate([...])`, `.sort('field:asc|desc')`, `.search(q)`, `.locale(l)`, `.status(s)`, `.page(n)`, `.limit(n)`, `.fetch()`).
- `.single(slug)` → `SingleClient`: `find({ locale? })`, `update(data)`.
- `.graphql(query, variables)` → raw GraphQL against the same tenant.
- Retry-with-backoff on HTTP 429 (respects `Retry-After`), typed `SaCMSError` on any other non-OK response.
- `mini-services/sdk/src/cli.ts` + `scripts/generate.ts` — a `sacms-gen` CLI that introspects a live workspace's schema and emits `generated-types.ts` for full `collection<K>()` intellisense. Read that script before changing how types are generated; it's a separate code path from the client and from AI Site.

## How AI Site wires it up

Every starter project (`src/lib/ai-site/template.ts`'s `STARTER_FILES`) ships:
- `@sacms/sdk` and `server-only` as real dependencies.
- `lib/sacms.ts`:
  ```ts
  import 'server-only'
  import { SaCMS } from '@sacms/sdk'

  export const sacms = new SaCMS({
    baseUrl: process.env.NEXT_PUBLIC_SACMS_API_URL!,
    tenant: process.env.NEXT_PUBLIC_SACMS_TENANT!,
    token: process.env.SACMS_API_KEY!,
  })
  ```
- The `server-only` import isn't decorative — `SACMS_API_KEY` is intentionally not `NEXT_PUBLIC_`-prefixed, so Next's bundler already resolves it to `undefined` in a client bundle rather than inlining the real value, but that's a silent broken-fetch failure mode, not an obvious error. `server-only` turns an accidental Client Component import into a build-time error instead.

The agent imports `sacms` from `@/lib/sacms` in any Server Component that needs real content — `await sacms.collection('articles').findMany({ sort: 'createdAt:desc' })`, `await sacms.single('homepage').find()` — never a raw `fetch()` to a SaCMS URL, and never its own auth scheme.

## How the connection gets there without the agent ever seeing a secret

`src/lib/ai-site/sandbox.ts`'s `writeFrontendEnv(sandbox, tenantId, tenantSlug)` (called from `prepareSandbox`, i.e. on every sync, not just the first one):
1. Calls `resolveFrontendEnv(tenantId, tenantSlug, apiOrigin)` + `renderDotEnv(env)` from `src/lib/infrastructure/frontend-env.ts` — **the same functions** the dashboard's own deploy path and the `deploy_to_sacms` MCP tool already use for real deployments, so a site behaves identically in the Sandbox preview and after an actual deploy. `resolveFrontendEnv` returns `{ ...tenantCustomVars, NEXT_PUBLIC_SACMS_API_URL, NEXT_PUBLIC_SACMS_TENANT, SACMS_API_KEY }`; `apiOrigin` is `process.env.NEXT_PUBLIC_APP_URL || "https://developer.sacms.cloud"`, matching the MCP route's own fallback exactly.
2. `resolveFrontendEnv` auto-provisions the workspace's service API token the first time it's needed (`getFrontendDeployToken` — `name: "SaCMS Cloud Hosting (${tenantSlug})"`, created once, reused forever) — same mechanism as the MCP `get_or_create_api_key` tool: never rotates or invalidates an existing token, only creates one if none exists.
3. Writes the result as `.env.local` **directly into the Sandbox filesystem** via `sandbox.writeFiles([...])` — bypassing `writeProjectFiles`/`AiSiteFile` entirely. This is the load-bearing detail: the real key is never stored as project source, never visible in the Code tab (which only ever reads `AiSiteFile` rows), and never writable by the model through `writeFiles` (`normalizeProjectPath` also hard-blocks `.env*` independently). See `references/security.md` for the one gap this *didn't* originally close (`runCommand`, now fixed) and what's still a denylist rather than a sandbox.

Net effect: the agent never sees a secret, never asks the user to configure anything, and the generated site is already correctly wired to real, live, tenant-isolated data on the very first preview.

## Keep these in sync

If a new `SYSTEM_ENV_VAR` is ever added to `frontend-env.ts`, or the SDK's constructor options change:
- Update `lib/sacms.ts`'s template string in `template.ts`.
- Update the system prompt's SDK paragraph in `prompt.ts`.

They describe the same contract from two sides — what actually gets injected, and what the agent is told exists — and drifting apart silently breaks generation (the agent will reference an env var that was never written, or vice versa).
