---
name: schema-architect
description: Design a SaCMS CMS schema (Content Types, Single Types, Components) that covers a whole website end to end — header to footer, every page, SEO, and theme settings — not just the main business data. Use for the AI Schema Generator's own prompt/logic, and for manually designing or reviewing any tenant's schema.
---

# Designing a whole-website CMS schema, not just the business data

A schema that only models "the thing the user talked about" (products, rooms, articles) and leaves the header, footer, homepage hero, and SEO settings hardcoded in the frontend is an unfinished schema — AI Site or any hand-built frontend ends up with no real data behind half the page. The bar here is the same one `ai-gateway`'s skill holds AI Site to: a generated/designed site should never fall back to placeholder text where a real editable field belongs.

This skill is the methodology; `src/lib/ai-schema-generator.ts`'s `SYSTEM_PROMPT` is where it's actually encoded for the live AI Schema Generator (`/developer/schema`). If you change the methodology here, update that prompt in the same change — a skill that describes a different process than the code actually runs is worse than no skill.

## Work header to footer, not topic-first

Before picking any Content Types, walk the whole page structure in this order — every real website has all four, whether or not the user's prompt mentioned them:

1. **Global site settings** — exactly one Single Type (e.g. `site-settings`) holding whatever the header and footer render on *every* page: logo/favicon, brand colors (`color` field, never free text), typography choice, nav links, footer columns, social links, contact info, and one site-wide default `seo` field other pages fall back to. If this doesn't exist, the header/footer have nothing real to read from.
2. **Each one-off page** — one Single Type per page that exists exactly once (Homepage, About, Contact, …). Model it section by section (hero, intro, map, whatever is actually on that page) as real fields or embedded Components — not one `richText` blob standing in for the whole page. Each gets its own `seo` field that overrides the site default.
3. **Repeatable business content** — one Content Type per *kind of thing the site needs many of* (products, articles, team members, bookings, …). This is the obvious part most schemas stop at. Wire real `relation` fields between these instead of duplicating data (an article relates to its author, a product relates to its category).
4. **Reusable embedded groups** — Components for anything whose *shape* repeats *inside* another type without needing its own list or URL (a CTA block, a feature card, a testimonial quote embedded in the Homepage). See the decision rule below for Component vs Content Type.

## Content Type vs Single Type vs Component — the actual decision rule

| Question | Content Type | Single Type | Component |
| --- | --- | --- | --- |
| Does it exist exactly once? | No — many rows | Yes — exactly one | N/A, it's embedded |
| Does it need its own detail page / URL? | Yes | Sometimes (it IS the page) | No, never |
| Is it edited standalone or always alongside a parent? | Standalone | Standalone | Always alongside a parent |
| Could there be unboundedly many over time? | Yes | No | No (bounded by how many times it's embedded) |

When in doubt between Content Type and Component for something that "repeats": if it needs its own list view and its own URL, it's a Content Type; if it only ever shows up embedded inside something else's fields (a homepage's feature cards, a settings page's social links), it's a Component.

## Field-type checklist (don't default everything to text/richText)

- **SEO** — every public Single Type and Content Type gets a `seo` field (meta title/description/OG image), not just the homepage.
- **Color** — any brand/theme color is a `color` field, never a text description of one ("tipe warna website" always means a real color picker field).
- **Relation** — cross-references between types use `relation` + `relationSlug`, never a duplicated copy of the related data.
- **Component** — embedded reusable groups use `component` + `componentSlug`.
- **Currency/Percent/Rating** — money, discounts, and star ratings have dedicated field types; don't fall back to plain numbers.
- **Media vs MediaMultiple vs File** — a single cover image, a gallery, and a downloadable document are three different field types, not all `media`.
- Full list: `src/lib/field-types.ts`'s `FIELD_TYPES` (also rendered into the live prompt as `FIELD_TYPE_DOCS`) — check it before assuming a field type exists or inventing one that doesn't.

## Slugs must be kebab-case, not snake_case

The save endpoint and every hand-authored Content Type enforce `/^[a-z0-9][a-z0-9-]*$/` — hyphens only, no underscores (see `lib/validations/admin.ts`'s `createContentTypeSchema`). A schema that previews fine with snake_case slugs (`cover_image`) will 400 on save. `ai-schema-generator.ts`'s `normalizeSchemaSlugs()` already kebab-cases every generated schema defensively (model slugs and field `slug`/`relationSlug`/`componentSlug` together, so cross-references still resolve) — but don't reintroduce snake_case in a prompt or hardcoded fallback schema on the assumption "someone will normalize it later." Write kebab-case from the start.

## Finalize/draft: why a schema needs a settled state before AI Site touches it

`src/lib/schema-lock.ts`'s `Tenant.schemaFinalizedAt` is a tenant-wide draft/final toggle (not full version history): while final, every schema-mutating surface is rejected — the manual Content Types/Single Types/Components CRUD actions, the AI Schema Generator's own save/import route, and (because AI Site's `cms_create_content_type` etc. tools call those exact same actions) AI Site's own schema-building tools too. One check (`assertSchemaFinalizedForAiSite` in the same file) additionally *requires* the schema be final before AI Site will create a project, create a chat, or answer a single chat turn.

The reasoning: AI Site builds a real Next.js frontend with real `sacms.collection('x').findMany()` calls against specific field names. If the schema keeps changing underneath that generated code, every earlier generation turn's assumptions silently rot. Finalizing first means AI Site spends its whole 40-step tool budget on the frontend, not on re-discovering a moving target. To change a finalized schema, the tenant must explicitly return to draft (`PATCH /api/tenant/[tenant]/schema-status` with `{finalized: false}`) — a deliberate, visible step, not an accidental edit.

If you're working on either the Schema Generator or AI Site and a save/generate call fails with a "skema sudah difinalkan" / "skema belum difinalkan" message, that's this gate working as intended, not a bug — check `/developer/schema`'s Draft/Final badge before assuming something else broke.

## How to verify a change here

Same as `ai-gateway`'s skill: `tsc --noEmit`, `bun run lint`, `bun run test`, `bun run build`, all four. If you change `SYSTEM_PROMPT`, there's no automated check that the *output* actually follows the new methodology — generate against a few different prompts by hand (a hotel, a SaaS landing page, a portfolio) and check the result actually has a `site-settings` Single Type, per-page Single Types, and real relations, not just more Content Types.
