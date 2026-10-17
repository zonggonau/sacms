---
name: ai-gateway
description: Build and modify SaCMS AI Site — SaCMS's own Lovable/v0-class in-dashboard website builder, its Vercel AI Gateway wrapper, agent tools, chat streaming, Vercel Sandbox previews, and the real @sacms/sdk data layer generated sites run on.
---

# SaCMS AI Site: a professional, Lovable/v0-class website builder

AI Site (`/dashboard/[tenant]/developer/aisite`) is SaCMS's own equivalent of Lovable or v0.dev: describe a website in chat, and the agent writes a complete, production-quality Next.js app — polished UI, real data, a working build, a live preview — in the same conversation. This replaced an earlier "no in-dashboard AI website gen" policy (see memory `site-builder-architecture` / `ai-site-feature`); that reversal was intentional and user-confirmed, not an oversight.

**The bar for "done" is the same bar Lovable and v0 hold themselves to**: the generated site builds cleanly, looks like a real product (not a wireframe), is responsive and accessible, and is wired to the workspace's *actual* content through a real, typed SDK — not placeholder text the user has to go hunt down and replace later. A generated site that only ever shows lorem-ipsum where a real Content Type clearly belongs is an unfinished job.

The agent itself runs on Vercel AI SDK (`ai` v7) routed through Vercel AI Gateway. There is no `mini-services/v0-clone` runtime dependency; that folder was only ever a reference app this was ported *from*. `mini-services/sdk` is different — it's `@sacms/sdk`, a real published package the generated sites actually depend on. **Its source here is ahead of what's live on npm** (fixes for a severe leaked-internal-data bug and more, version `1.1.0` locally) — `npm publish` hit the account's 2FA and hasn't completed; see `references/sdk-and-templates.md`'s top note before assuming a fix is actually in effect for a freshly-generated site.

## Before you touch anything: read the relevant reference, not just this file

This file is the map, not the territory. Each reference below was written and verified against the *current* source in this session — read it instead of re-deriving the same facts from scratch, and update it in place if you find it's drifted from the code.

| Working on... | Read |
| --- | --- |
| The agent itself: model choice, tools, quota, chat streaming | `references/architecture.md` |
| Generated sites fetching real CMS data, `@sacms/sdk`, the starter template | `references/sdk-and-templates.md` |
| Live previews, Sandbox lifecycle, Vercel credentials/failure modes | `references/sandbox-and-preview.md` |
| Anything touching secrets, tenant isolation, or a new tool's blast radius | `references/security.md` — **read this one even if your change feels unrelated** |

For the generated site's own UI/UX conventions (shadcn, theme tokens, when to run `npx shadcn@latest add`), see the separate `ai-site-ui` skill, not this one.

## The non-negotiables (detail in the references above)

- **One project per workspace, one chat per project.** It's the single website being developed, not one of many. Don't reintroduce a project list or a "new chat" button without removing this constraint deliberately and discussing it first — it was an explicit product decision, not a v1 limitation.
- **Model is picked per chat on the landing screen** (`src/lib/ai-site/models.ts`'s curated `AI_SITE_MODEL_OPTIONS`, stored on `AiSiteChat.model`), not inherited from the platform-wide admin default and not switchable mid-conversation. A 40-step tool loop needs more reliable function calling than a one-shot generation gets away with.
- **CMS mutation tools never carry their own authorization** — they call the same dashboard-facing server actions a human uses, which re-derive the real session's RBAC/plan limits every time. Never give a tool a shortcut that skips that.
- **A provisioned secret (the Gateway key, the tenant's API token) is written where the model's own tools can't read it back** — the Sandbox filesystem directly, never through `AiSiteFile`/the Code tab/`runCommand`'s unfiltered args. See `references/security.md` for the one place this was wrong and got fixed this session.
- **DB-stored Settings always beat `.env` when non-empty**, even when stale. Confirmed twice in one session (Vercel token, then the Gateway key) as the actual cause of "but the env file is right" failures.
- **Zod schemas for tools**: no `.optional()` on a 4+-key object schema (zod v4 + `ai`@7 breaks `tool()`'s type inference with a misleading error). Use `.default(sentinel)`. Full explanation in `references/architecture.md`.

## How to verify a change here

`tsc --noEmit`, `bun run lint`, `bun run test`, `bun run build` after any edit — all four, every time, not a subset. None of them exercise a live Sandbox or a live Gateway call; for that, see `references/sandbox-and-preview.md`'s "what's NOT verified live" section and don't claim more than source-reading actually supports. If you fix something and it changes behavior documented in a reference file, update that file in the same change — a skill that drifts from the code it describes is worse than no skill.
