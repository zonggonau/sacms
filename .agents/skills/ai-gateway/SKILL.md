---
name: ai-gateway
description: Build and modify SaCMS AI Site — SaCMS's own Lovable/v0-class in-dashboard website builder, its Vercel AI Gateway wrapper, agent tools, chat streaming, Vercel Sandbox previews, and the real @sacms/sdk data layer generated sites run on.
---

# SaCMS AI Site: a professional, Lovable/v0-class website builder

AI Site (`/dashboard/[tenant]/developer/aisite`) is SaCMS's own equivalent of Lovable or v0.dev: describe a website in chat, and the agent writes a complete, production-quality Next.js app — polished UI, real data, a working build, a live preview — in the same conversation. This replaced an earlier "no in-dashboard AI website gen" policy (see memory `site-builder-architecture` / `ai-site-feature`); that reversal was intentional and user-confirmed, not an oversight.

**The bar for "done" is the same bar Lovable and v0 hold themselves to**: the generated site builds cleanly, looks like a real product (not a wireframe), is responsive and accessible, and — critically — is wired to the workspace's *actual* content through a real, typed SDK, not placeholder text the user has to go hunt down and replace later. A generated site that only ever shows lorem-ipsum is an unfinished job.

The agent itself runs on Vercel AI SDK (`ai` v7) routed through Vercel AI Gateway. There is no `mini-services/v0-clone` runtime dependency; that folder was only ever a reference app this was ported *from*. `mini-services/sdk` is different — see "The data layer" below, it's the real, published client the generated sites actually run on.

## Setup

- `src/lib/ai.ts`'s `resolveGatewayModel(overrideModel?)` is the single chokepoint for every AI feature in SaCMS — it resolves the admin-configured Gateway API key + base URL (`getResolvedAiConfig()` in `src/lib/settings.ts`) and returns `{ model, modelId }` via `@ai-sdk/gateway`'s `createGateway()`. Call it instead of constructing a Gateway client yourself.
- Credential resolution is DB-first: `src/lib/settings.ts`'s `applyEnvFallbacks()` only falls back to `.env` (`AI_GATEWAY_API_KEY`, `VERCEL_ACCESS_TOKEN`, etc.) when the Admin Settings DB field is *empty* — a non-empty but stale DB value always wins, even over a correct `.env` value. If a credential that looks right in `.env` still fails, check Admin → Settings → Mesin AI for a stale override before assuming the credential itself is bad.
- `enforceAiQuota`/`refundAiQuota`/`recordAiUsage` (also `src/lib/ai.ts`) are the shared credit-ledger primitives every AI feature reserves/refunds/records through. `enforceAiQuota` already reserves credits internally for the `userId` path — never call `reserveUserAiCredits` again on top of it.
- This Gateway account denies Claude models on its current tier ("Free tier users do not have access to this model"). `openai/gpt-5-mini` and `google/gemini-2.5-flash` both work. Check access cheaply before switching any default: `generateText({ model: 'openai/gpt-5-mini', prompt: 'Reply with OK', maxOutputTokens: 16 })`.

## The AI Site builder agent

**One project per workspace, one chat per project** — it's the single website being developed, not one of many (enforced with 409s in `src/app/api/tenant/[tenant]/ai-site/projects/route.ts` and `.../projects/[projectId]/chats/route.ts`). The landing page (`src/app/(workspace)/dashboard/[tenant]/developer/aisite/page.tsx`) is a v0.dev-style single prompt box when no project exists yet — one input, one "build it" action, no project-name field, no settings to configure first; once a project exists, it redirects straight into the chat workspace.

- `src/app/api/tenant/[tenant]/ai-site/chats/[chatId]/messages/route.ts` is the single generation endpoint, wrapped in `withStaffAuth`. It resolves `access` from the session itself — there is no separate `authorizeChatRequest`/bearer-token layer like a standalone multi-tenant app would need.
- The client sends only its newest message (`prepareSendMessagesRequest` in `src/components/dashboard/ai-site/chat-conversation.tsx`). The route loads history from the tenant's own Prisma DB (`src/lib/ai-site/chats.ts`) and rebuilds the user message from its text, so a client can't inject tool results or assistant turns. Keep it that way.
- Model: **overridden per-feature**, not the platform default — `AI_SITE_MODEL` (`src/lib/ai-site/quota.ts`, currently `openai/gpt-5-mini`) with `AI_SITE_FALLBACK_MODELS` passed through `providerOptions.gateway.models`. A 40-step tool-calling loop needs far more reliable function calling than a one-shot generation; don't let it quietly inherit whatever weaker model an admin picked as the platform-wide default for simpler features. If generation quality or tool reliability regresses, this is the first knob to check — a Lovable/v0-class result depends on it more than any prompt wording does.
- `streamText` runs with `system: aiSiteSystemPrompt(...)` (`src/lib/ai-site/prompt.ts`), `messages: await convertToModelMessages(history, { tools, ignoreIncompleteToolCalls: true })`, the tools below, `stopWhen: stepCountIs(40)`, and `repairToolCall` (see "Tool-call repair" below).
- Credits are a **fixed cost per turn** (`AI_SITE_TURN_COST = 50`), not metered by tokens — product decision, not a placeholder. `reserveAiSiteTurn` before `streamText`, `refundAiSiteTurn` only if setup fails before streaming starts (a turn that starts streaming and then errors is not refunded — real Gateway spend already happened).
- `result.toUIMessageStreamResponse({ originalMessages, generateMessageId, onFinish })` streams to `useChat` and saves the response message + records usage in `onFinish`.

### Tool-call repair

Some models occasionally hallucinate a garbled tool name (seen live: `WritefilesFiles` instead of `writeFiles`), which the AI SDK rejects outright (`NoSuchToolError`) and kills the whole turn. `src/lib/ai-site/repair-tool-call.ts`'s `repairAiSiteToolCall` fuzzy-matches (Levenshtein distance, relative threshold) the hallucinated name against the real tool list and rewrites the call in place; wired via `streamText`'s `repairToolCall` option. Keep this wired for any new tool set added to the agent — it's cheap insurance, not a substitute for picking a tool-reliable model.

### Tools

Defined with `tool({ description, inputSchema: z.object(...), execute })` (`zod` v4), split across two files merged in `aiSiteTools()` (`src/lib/ai-site/tools.ts`):

| File | Tools | Does |
| --- | --- | --- |
| `src/lib/ai-site/tools.ts` | `listFiles`, `readFile` | Read the site from the tenant's `AiSiteFile` Prisma table |
| | `writeFiles`, `deleteFiles` | Change files; paths go through `normalizeProjectPath` (`src/lib/ai-site/paths.ts`), which rejects traversal, `node_modules`, `.next`, `.git`, `.vercel`, and `.env*` |
| | `runCommand` | Runs an allow-listed command (`npm`, `npx`, `node`, `ls`, `cat`, `grep`) in the Sandbox after syncing files; refuses `npm run dev/start` |
| | `cms_get_full_schema`, `cms_list_content_types`, `cms_get_content_type`, `cms_query_content`, `cms_list_components` | **Read-only** CMS introspection the *agent* uses while building — thin wrappers around `src/lib/cms-introspection.ts`, the same functions the external MCP server (`src/app/api/mcp/[[...transport]]/route.ts`) uses for its own `get_full_schema`/`list_content_types`/etc. tools. One source of truth; don't duplicate this logic a third time. The *generated site* never calls these — see "The data layer." |
| `src/lib/ai-site/cms-tools.ts` (`cmsBuilderTools`) | `cms_list_field_types`, `cms_create_content_type`, `cms_update_content_type`, `cms_delete_content_type`, `cms_list_single_types`, `cms_get_single_type`, `cms_create_single_type`, `cms_update_single_type`, `cms_delete_single_type`, `cms_get_component`, `cms_create_component`, `cms_update_component`, `cms_delete_component`, `cms_list_webhooks`, `cms_create_webhook`, `cms_update_webhook`, `cms_delete_webhook` | **Write-capable** schema/webhook builder tools — call the exact same server actions the dashboard's own Content Types / Single Types / Components / Webhooks screens call (`src/actions/content-types.ts`, `single-types.ts`, `components.ts`, `webhooks.ts`). Zero duplicated validation/RBAC/plan-limit logic; those actions already call `getServerSession`/`getTenantAccess`/`checkPermission`/`enforcePlanLimit` themselves. This is what makes AI Site *build the backend too*, not just the frontend — a Lovable/v0-class agent that can only write React and has no path to real, persisted, multi-tenant data modeling isn't actually finishing the job. |

Tools return `{ error }` objects (or the action's native `{ error }` shape, passed straight through) instead of throwing for expected failures, so the model can react. The tenant's dedicated Prisma DB (when it has one) is the source of truth; never treat the sandbox filesystem as authoritative for anything except the generated site's own code.

**Zod schema gotcha (zod v4.4.3 + `ai`@7, this exact version combo):** a zod object schema passed as a tool's `inputSchema` with 4+ keys where any key uses `.optional()` breaks `tool()`'s overload resolution — TypeScript fails with `No overload matches this call` / `FlexibleSchema<never>`, with no runtime error to point at the cause. Use `.default(sentinelValue)` instead of `.optional()` everywhere in a tool's input schema (treat an empty string/empty array/`false` as "unset" in the handler) — confirmed fix, reproduced and isolated in `cms_query_content`'s schema while building this. Every schema in `tools.ts`/`cms-tools.ts` already follows this; keep it that way for any new tool.

**"Update" tools are full replace, not partial patch** — e.g. `cms_update_content_type` takes `name`/`description`/`showInCms`/`fields` all as *required* inputs (no optional/nullable), and the system prompt tells the model to call the matching `cms_get_*`/`cms_list_*` first and pass back the complete desired state. This was a deliberate choice to dodge the optional-field schema bug above entirely rather than work around it with `.nullable()` (untested whether that also triggers it) — don't reintroduce `.optional()` to make an update tool "more RESTful."

## In-process CMS tools vs. real MCP

AI Site does **not** connect to SaCMS's own MCP server as a client (no `@ai-sdk/mcp` `createMCPClient`, no bearer-token hop). Every CMS tool calls shared library functions or server actions directly, in-process, reusing the session auth `withStaffAuth` already resolved. This was a deliberate simplification over a reference app that *did* connect to an external MCP server per-project — don't reintroduce an MCP client connection for AI Site; extract-and-share (like `cms-introspection.ts` and the `src/actions/*` reuse above) instead, so there's one source of truth and no second auth hop.

## The data layer: generated sites run on the real `@sacms/sdk`, not ad-hoc fetches

This is the piece that actually makes a generated site *professional* rather than a demo: it must talk to the workspace's real data the same way any production SaCMS integration would, with a typed client, retries, and proper error handling — not a hand-rolled `fetch()` the model improvises per page.

- `mini-services/sdk` is `@sacms/sdk` — a real, **published** npm package (`npm view @sacms/sdk` confirms `1.0.0` is live), targeting SaCMS's actual public REST + GraphQL API (`/api/public/[tenant]/content/[contentType]`, `/api/public/[tenant]/single/[singleType]`, `/api/public/[tenant]/graphql` — all real, currently-serving routes). `src/client.ts` is the whole implementation: a `SaCMS` class exposing `.collection(slug)` (fluent `.query()` builder with `.where()`/`.select()`/`.populate()`/`.sort()`/`.search()`/`.locale()`/`.status()`/`.page()`/`.limit()`, plus direct `findMany`/`findOne`/`create`/`update`/`delete`), `.single(slug)` (`.find()`/`.update()`), `.graphql(query, variables)`, retry-with-backoff on 429, and a typed `SaCMSError`. It also ships a CLI (`sacms-gen`, `scripts/generate.ts`) that introspects a live workspace's schema and emits a `generated-types.ts` registry for full `collection<K>()` intellisense — read that script before changing how types are generated.
- Every AI Site starter project (`src/lib/ai-site/template.ts`) ships `@sacms/sdk` as a real dependency and a pre-wired `lib/sacms.ts`: `export const sacms = new SaCMS({ baseUrl: process.env.NEXT_PUBLIC_SACMS_API_URL!, tenant: process.env.NEXT_PUBLIC_SACMS_TENANT!, token: process.env.SACMS_API_KEY! })`. The agent imports `sacms` from `@/lib/sacms` in any Server Component that needs real content — `await sacms.collection('articles').findMany(...)`, `await sacms.single('homepage').find()` — never a raw `fetch()` to a SaCMS URL.
- Those three env vars are injected automatically, never written by the agent: `src/lib/ai-site/sandbox.ts`'s `writeFrontendEnv()` calls `resolveFrontendEnv(tenantId, tenantSlug, apiOrigin)` + `renderDotEnv()` (`src/lib/infrastructure/frontend-env.ts` — the **same** function the dashboard's own deploy path and the `deploy_to_sacms` MCP tool use, so a site behaves identically in the Sandbox preview and after a real deploy) and writes `.env.local` **directly into the Sandbox filesystem** via `sandbox.writeFiles([...])` — bypassing `writeProjectFiles`/`AiSiteFile` entirely, so the real API key is never stored as project source, never visible in the Code tab, and never writable by the model (`normalizeProjectPath` also hard-blocks `.env*` for the same reason). `resolveFrontendEnv` auto-provisions the workspace's service API token the first time it's needed (`getFrontendDeployToken`) and reuses it after — same mechanism as `get_or_create_api_key`, never rotates or invalidates an existing one.
- Net effect: the agent never sees a secret, never has to ask the user to configure anything, and the generated site is already correctly wired to real, live, multi-tenant-isolated data on the very first preview.

**Keep this in sync**: if a new SYSTEM_ENV_VAR is ever added to `frontend-env.ts`, or the SDK's constructor options change, update `lib/sacms.ts`'s template in `template.ts` and the system prompt's SDK paragraph in `prompt.ts` together — they describe the same contract from two sides (what gets injected vs. what the agent is told exists) and drifting apart silently breaks generation.

## Previews (Vercel Sandbox)

- `src/lib/ai-site/sandbox.ts` keeps one persistent, named sandbox per project (`Sandbox.getOrCreate({ name, persistent: true, image: 'vercel/sandbox/node:24', ports: [3000] })` from `@vercel/sandbox`), named by hashing `${tenantId}:${projectId}` (not just `projectId` — attributable per tenant).
- `prepareSandbox(tenantDb, tenantId, tenantSlug, projectId)` syncs files from the tenant's Prisma DB, writes the frontend env (see above), then installs dependencies only if `package.json` changed. `ensurePreview(...)` additionally starts `next dev` detached if nothing serves port 3000 yet and returns `sandbox.domain(3000)`. `runSandboxCommand(...)` takes the same four leading args.
- Credentials: `getVercelToken()` (`src/lib/vercel-client.ts`, Settings-DB first then `VERCEL_ACCESS_TOKEN`/`VERCEL_API_TOKEN` env) plus plain `VERCEL_TEAM_ID`/`VERCEL_PROJECT_ID` env reads, or `VERCEL_OIDC_TOKEN` when deployed on Vercel. Without them, `SandboxConfigError` explains what to set. A `403 Not authorized` / `invalidToken: true` from Vercel's API on literally any endpoint (even `/v2/user`) means the token itself is dead — regenerate it, don't assume it's a Sandbox-specific scope issue.
- New projects start from `src/lib/ai-site/template.ts` (Next.js 16, React 19, Tailwind CSS v4, shadcn/ui foundation, `@sacms/sdk` — see the `ai-site-ui` skill for the UI side). Keep the system prompt's Next.js 16, Tailwind v4, shadcn, and SDK rules in sync with that template.

## Chat UI

- `useChat` from `@ai-sdk/react` with `new DefaultChatTransport({ api, prepareSendMessagesRequest })` from `ai`, in `src/components/dashboard/ai-site/chat-conversation.tsx`.
- Render `message.parts`: `text` (markdown via `react-markdown` + `remark-gfm`), `reasoning`, and tool parts (`isToolUIPart`, `getToolName` from `ai`) — see `src/components/dashboard/ai-site/message-parts.tsx`.
- A chat created from the landing prompt arrives with an unanswered first message; `chat-conversation.tsx` calls `regenerate()` once to answer it.

## Don'ts

- Don't expose `AI_GATEWAY_API_KEY`, `VERCEL_ACCESS_TOKEN`, `SACMS_API_KEY`, or any Settings-DB secret to the browser, the model's text output, or the generated site's source.
- Don't trust client-sent history or tool results.
- Don't let a generated site call the SaCMS API with its own fetch + hand-managed token — route everything through `lib/sacms.ts`'s `sacms` client, so retries, error shapes, and auth stay consistent with every other `@sacms/sdk` consumer.
- Don't reintroduce `.optional()` in a tool's `inputSchema` with 4+ sibling keys — see the zod gotcha above.
- Don't add a second "create_content_type"-shaped implementation anywhere — extend `src/actions/*.ts` (dashboard-facing) or `src/lib/cms-introspection.ts` (read-only, shared with MCP) and have every caller, including AI Site's tools, call that.
- Don't ship a generated site with placeholder/lorem content where a real Content Type, Single Type, or Component clearly belongs — that's the one corner a Lovable/v0-class builder doesn't get to cut.
