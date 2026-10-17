# The data layer: generated sites run on the real `@sacms/sdk`

This is the piece that makes a generated site professional rather than a demo: it talks to the workspace's real data the same way any production SaCMS integration would, with a typed client, retries, and proper error handling — not a hand-rolled `fetch()` the model improvises per page.

## Publish status — check this before assuming behavior

`mini-services/sdk`'s `package.json` is at **`1.1.0`** locally (everything below describes this version), but publishing it hit npm's 2FA (`EOTP` — needs a one-time password from the account owner's authenticator, which an agent can't provide) and was not completed as of this writing. **`npm view @sacms/sdk version` may still report `1.0.0`** — the version with the bugs this file used to describe (baked-in internal SaCMS data shipped to every consumer, a CLI that silently produced the same output regardless of the real schema, no `$and` filter support, no member-auth). AI Site's starter template installs `@sacms/sdk@^1.0.0` fresh inside each Sandbox — until `1.1.0` is actually live on npm, every new AI Site project is running the **old, buggy** version, not the one described here. Check `npm view @sacms/sdk version` whenever this matters; don't assume 1.1.0 just because the source in this repo has it.

## What `@sacms/sdk` actually is

`mini-services/sdk/src/client.ts` is the whole implementation:
- `SaCMS<Registry = EmptyRegistry>` class, constructed with `{ baseUrl, tenant, token, locale? }`. **Generic since 1.1.0** — there is no tenant-specific schema baked into the package. `new SaCMS(...)` with no type argument is fully untyped (`collection()`/`single()` accept any slug, return `Record<string, unknown>` unless you pass an explicit per-call generic). `new SaCMS<MyRegistry>(...)`, with a registry produced by the CLI below, gets real per-slug type inference.
- `.collection(slug)` → `CollectionClient`: `findMany(params)`, `findOne(id)`, `create({ data, locale?, status? })` (`status` is accepted but has **no effect** — the real backend always creates DRAFT via the public API; don't "fix" this by changing backend behavior, it's a deliberate safety property, not a bug), `update(id, params)`, `delete(id)`, plus `.query()` for a fluent builder (`.where(field, op, value)`, `.select([...])`, `.populate([...])`, `.sort('field:asc|desc')`, `.search(q)`, `.locale(l)`, `.status(s)`, `.page(n)`, `.limit(n)`, `.fetch()`).
- `.single(slug)` → `SingleClient`: `find({ locale? })`, `update(data)`.
- `.graphql(query, variables)` → raw GraphQL against the same tenant.
- `.auth` → `AuthClient` (`src/auth.ts`, added in 1.1.0): `login`, `register`, `refresh`, `logout`, `me`, `updateMe`, `changePassword`, `forgotPassword`, `resetPassword`, `confirmEmail` — wraps the real `/api/public/[tenant]/auth/*` member (end-user) auth endpoints. `me`/`updateMe`/`changePassword` need the *member's own* access token (from `login`/`register`/`refresh`), not the `SaCMS` instance's service token — the client overrides the `Authorization` header per-call for these. AI Site's generated sites don't use this yet; it exists for when a generated app needs its own user accounts (a SaaS dashboard, a forum).
- Retry-with-backoff on HTTP 429 (respects `Retry-After`) **and on a pure network failure** (DNS, connection reset — added in 1.1.0; previously this escaped as a raw exception the README's own `catch (SaCMSError)` pattern couldn't catch). Throws typed `SaCMSError` either way (`status: 0` for an exhausted network-failure retry).
- `$or` and `$and` filter groups both actually work (added in 1.1.0 for `$and` — the SDK always serialized it, but `src/lib/filters.ts`'s `parseFilters` only ever handled `$or`; a query using `$and` used to silently filter nothing).
- `mini-services/sdk/src/cli.ts` — the `sacms-gen` CLI. As of 1.1.0 it genuinely works: fetches real GraphQL introspection from the target instance and parses it (resolving each query field's return type — `XCollection`-wrapped for a Content Type, direct for a Single Type — then emitting one interface per real type with real field names/types/nullability) into a `SaCMSRegistry`-shaped file you import and pass to `new SaCMS<...>`. Before 1.1.0 it fetched the introspection response and never read it, always writing the same generic placeholder. There is no other generator — the old `scripts/generate.ts` (local-Prisma, non-tenant-scoped, referenced a Prisma relation that doesn't exist) was deleted; don't resurrect it.

**The `EmptyRegistry` gotcha, if you ever touch `generated-types.ts` again**: the default empty registry's `collections`/`singles` must be a closed `{}`, not `Record<string, never>`. An index-signature type like `Record<string, never>` still matches *any* string key (it just resolves the value to `never`), so `SaCMS`'s typed overload (`collection<K extends keyof Registry["collections"]>`) keeps winning for every slug and silently infers `never` instead of falling through to the untyped `Record<string, unknown>` overload — `result.data.whatever` becomes a type error on literally every call. This exact mistake was caught by the **pre-existing** SDK test in the main repo (`__tests__/sdk/client.test.ts` — note this lives in the main app's test suite, not inside `mini-services/sdk`; check there too before claiming "no test coverage"), not by anything inside the SDK package itself at the time.

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
  This is the **untyped** default (no `<Registry>` type argument) — deliberate for now. The agent already knows the real schema at build time via `cms_get_full_schema`/etc. and writes `collection("articles").findMany()` calls that are correct in practice; it doesn't need compile-time inference to get the slug or shape right. Generating a real `SaCMSRegistry` via `npx sacms-gen generate` inside the Sandbox and wiring `new SaCMS<MyRegistry>(...)` would be a reasonable fast-follow for stronger guarantees, but isn't wired up — don't assume it is.
- The `server-only` import isn't decorative — `SACMS_API_KEY` is intentionally not `NEXT_PUBLIC_`-prefixed, so Next's bundler already resolves it to `undefined` in a client bundle rather than inlining the real value, but that's a silent broken-fetch failure mode, not an obvious error. `server-only` turns an accidental Client Component import into a build-time error instead.

The agent imports `sacms` from `@/lib/sacms` in any Server Component that needs real content — `await sacms.collection('articles').findMany({ sort: 'createdAt:desc' })`, `await sacms.single('homepage').find()` — never a raw `fetch()` to a SaCMS URL, and never its own auth scheme.

## How the connection gets there without the agent ever seeing a secret

`src/lib/ai-site/sandbox.ts`'s `writeFrontendEnv(sandbox, tenantId, tenantSlug)` (called from `prepareSandbox`, i.e. on every sync, not just the first one):
1. Calls `resolveFrontendEnv(tenantId, tenantSlug, apiOrigin)` + `renderDotEnv(env)` from `src/lib/infrastructure/frontend-env.ts` — **the same functions** the dashboard's own deploy path and the `deploy_to_sacms` MCP tool already use for real deployments, so a site behaves identically in the Sandbox preview and after an actual deploy. `resolveFrontendEnv` returns `{ ...tenantCustomVars, NEXT_PUBLIC_SACMS_API_URL, NEXT_PUBLIC_SACMS_TENANT, SACMS_API_KEY }`; `apiOrigin` is `process.env.NEXT_PUBLIC_APP_URL || "https://developer.sacms.cloud"`, matching the MCP route's own fallback exactly.
2. `resolveFrontendEnv` auto-provisions the workspace's service API token the first time it's needed (`getFrontendDeployToken` — `name: "SaCMS Cloud Hosting (${tenantSlug})"`, created once, reused forever) — same mechanism as the MCP `get_or_create_api_key` tool: never rotates or invalidates an existing token, only creates one if none exists. This is the `SaCMS` service token — a different credential from the member-level `.auth` tokens above.
3. Writes the result as `.env.local` **directly into the Sandbox filesystem** via `sandbox.writeFiles([...])` — bypassing `writeProjectFiles`/`AiSiteFile` entirely. This is the load-bearing detail: the real key is never stored as project source, never visible in the Code tab (which only ever reads `AiSiteFile` rows), and never writable by the model through `writeFiles` (`normalizeProjectPath` also hard-blocks `.env*` independently). See `references/security.md` for the one gap this *didn't* originally close (`runCommand`, now fixed) and what's still a denylist rather than a sandbox.

Net effect: the agent never sees a secret, never asks the user to configure anything, and the generated site is already correctly wired to real, live, tenant-isolated data on the very first preview — **once `1.1.0` is actually published**; see the publish-status note at the top.

## Keep these in sync

If a new `SYSTEM_ENV_VAR` is ever added to `frontend-env.ts`, or the SDK's constructor options change:
- Update `lib/sacms.ts`'s template string in `template.ts`.
- Update the system prompt's SDK paragraph in `prompt.ts`.
- Update this file's publish-status note if `1.1.0` (or later) actually goes live, or if the version changes again.

They describe the same contract from several sides — what actually gets injected, what the agent is told exists, and what's actually live on npm — and drifting apart silently breaks generation (the agent will reference an env var that was never written, assume a fix is live when it isn't, or vice versa).
