# Implementation Traceability & Documentation Baseline

**Audit method:** Static inspection only; no test, build, lint, migration, or external service call was executed.  
**Baseline date:** 19 June 2026  
**Repository package version:** `0.2.0`  
**Documentation release label:** Product capability baseline; not a declaration that production acceptance tests passed.

## 1. Purpose

This document prevents requirements, manuals, API examples, and source code from drifting apart. It distinguishes implemented behavior from partial capabilities and planned behavior. When another document conflicts with this matrix, the source code and Prisma schema remain the runtime truth, while this matrix must be updated in the same change.

## 2. Source-of-truth hierarchy

1. `prisma/schema.prisma` for persisted models, fields, relations, constraints, and enums.
2. `src/lib/content-workflow-rules.ts` for content lifecycle transitions and role rules.
3. `src/app/api/**/route.ts` for HTTP method, path, authentication, payload, and response behavior.
4. `src/actions/*.ts` for dashboard mutation behavior.
5. `src/lib/*.ts` for reusable business rules.
6. `src/app/**/page.tsx` and sidebar components for currently reachable UI workflows.
7. `docs/04-openapi.yaml` for the stable public API subset only.
8. Narrative documents in this directory.

## 3. Capability status vocabulary

| Status | Meaning |
|---|---|
| Implemented | A complete runtime path exists and is reachable from API or UI |
| Implemented with constraint | Works, but only within the explicitly documented boundary |
| Partial | Core code exists, but an expected workflow, guard, UI, or operational step is incomplete |
| Planned | Requirement or design intent without a complete runtime path |
| Historical | Kept for migration/context and must not be used as current operating guidance |

## 4. Product capability matrix

| Capability | Status | Primary implementation | Current boundary |
|---|---|---|---|
| Credentials authentication | Implemented | `src/lib/auth.ts` | Email must be verified; legacy password hash migrates on login |
| Google/GitHub OAuth | Implemented with constraint | `src/lib/auth.ts` | Provider appears only when its env variables exist |
| Multi-tenant membership | Implemented | `Tenant`, `TenantMember`, `getTenantAccess()` | Super admin receives an owner-equivalent access context |
| Account plan limits | Implemented with constraint | `src/lib/tenant-plan.ts`, `src/lib/plan-enforcement.ts`, `src/actions/tenant.ts`, `src/app/api/tenants/route.ts` | Free 1 workspace, Starter 3, Pro 10, Enterprise 20, Custom approved override |
| Workspace plan limits | Implemented with constraint | `src/lib/tenant-plan.ts`, `src/lib/plan-enforcement.ts`, `src/app/api/admin/global/seed/route.ts` | Free 3 content types/500 entries/1 member/100MB/1 locale/1,000 API calls; Starter 5/5,000/3/1GB/2/10,000; Pro 10/10,000/10/5GB/5/100,000; Enterprise 20/20,000/20/10GB/20/1,000,000 |
| Dedicated tenant database | Implemented with constraint | `Tenant.databaseUrl`, `getTenantDb()` | Falls back to shared master DB when no dedicated URL is configured |
| Collection Type modeling | Implemented | `ContentType`, `SchemaField`, content-type actions/routes | Tenant-owned and global-assigned schemas coexist |
| Single Type modeling | Implemented | `SingleType`, `TenantSingleTypeAssignment` | Uses assignment data rather than `ContentEntry` workflow |
| Reusable Components | Implemented | `Component`, `SchemaField`, component UI/actions | Schema impact analysis is present in management UI |
| Collection CRUD | Implemented | `src/actions/content.ts` | Dashboard uses Server Actions; Public REST is read-oriented |
| Content workflow | Implemented with constraint | `content-workflow-rules.ts`, content actions | Seven statuses; custom-role permission rows require workflow seed synchronization |
| Sequential review | Implemented | `ContentReviewAssignment`, reviewer route/UI | Reviewers must be same-tenant non-viewer members |
| Scheduled publish | Implemented | `/api/cron/publish` | Current Vercel cadence is every five minutes |
| Version history | Implemented | `ContentVersion` | Snapshots are created on create/update/auto-publish |
| Localization | Implemented with constraint | `TenantLocale`, `documentId`, locale UI/API | Shared fields are synchronized when `localizable=false` |
| Media library | Implemented | R2 utilities and tenant media routes | R2 credentials required for production storage |
| Image variants | Implemented with constraint | Tenant media upload route, `sharp` | Thumbnail/medium behavior depends on supported image MIME |
| REST collection API | Implemented | `/api/public/{tenant}/content/{contentType}` | GET list/filter/search/populate; max page size 100 |
| REST single-entry endpoint | Planned | OpenAPI previously described it | No `/content/{type}/{entryId}` route currently exists |
| Public Single Type API | Implemented | `/api/public/{tenant}/single/{singleType}` | GET; PUT requires full-access token |
| Dynamic GraphQL | Implemented | GraphQL route and schema generator | Query plus mutations for full-access tokens |
| API token hashing | Implemented | API token actions/routes | Plain token returned only at creation; SHA-256 stored |
| Public API cache | Implemented | `src/lib/cache.ts`, Public API route | Auth is resolved before cache lookup; cache key includes token ID |
| Rate limiting | Implemented with constraint | `src/proxy.ts`, `src/lib/rate-limit.ts` | Redis preferred; process-local fallback is not globally distributed |
| Webhooks | Implemented | `src/lib/webhooks.ts` | Sync hooks and async delivery with DLQ/retry |
| Audit trail | Implemented with constraint | `AuditLog`, audit helper/routes | Retention policy values exist; automatic purge must be operated separately |
| Export/import | Implemented with constraint | tenant export/import routes | JSON-oriented workspace transfer; inspect route response for exact archive support |
| Billing and Midtrans | Implemented with constraint | billing routes, payment provider layer | Environment/provider configuration determines active flow |
| Stripe/Xendit provider modules | Partial | `src/lib/payment/*` | Modules exist; Midtrans remains the documented primary UI flow |
| AI generation | Implemented with constraint | `src/lib/ai.ts`, tenant AI routes | DeepSeek key plus enabled feature/add-on required |
| Legacy `/addons/ai` mock | Historical/retired | Tenant add-on route returns HTTP 410 | Use `/ai/smart-fill` |
| AI usage quota accounting | Planned | Token usage returned by some operations | No canonical persisted per-tenant AI quota ledger was found |
| White-label branding | Implemented with constraint | white-label route/page | Pro, Enterprise, or Custom workspace plan |
| Custom domain | Implemented with constraint | domain route, `src/proxy.ts` | One domain per tenant; DNS TXT verification; Redis routing map |
| Multiple domains per tenant | Planned | — | Prisma currently stores one unique `customDomain` |
| Monitoring | Implemented with constraint | monitoring routes/pages, Sentry config | External Sentry activation depends on environment configuration |
| Automated DB backup endpoint | Implemented with constraint | `/api/cron/backup` | Endpoint method is GET; provider/storage configuration required |
| TypeScript SDK | Implemented with constraint | `mini-services/sdk` | Generated artifact must be refreshed when public schemas change |

## 5. Canonical actors

| Actor | Scope | Canonical role identifier |
|---|---|---|
| Platform administrator | All tenants/platform | `super_admin` on `User.role` |
| Workspace owner | One tenant | `owner` on `TenantMember.role` |
| Workspace administrator | One tenant | `admin` |
| Content editor | One tenant | `editor` |
| Basic contributor | One tenant | `member` |
| Read-only workspace user | One tenant | `viewer` |
| External API client | One tenant token | `read-only` or `full-access` token type |
| Scheduler | Background operation | Logical role `system` |

Do not use “reviewer” as a permanent built-in role. A reviewer is a tenant member assigned to a specific `ContentReviewAssignment`.

## 6. Canonical user journeys

### 6.1 Workspace onboarding

Register/verify email → sign in → create or select workspace → choose/manage plan → configure locale → create or assign schema → create API token → create content.

### 6.2 Content delivery

Model schema → create draft → complete required data → optional sequential review → approve → publish now or schedule → consume via REST/GraphQL → notify external system through webhook.

### 6.3 Developer integration

Create API token → choose REST, GraphQL, or SDK → request only the tenant bound to the token → use field selection/filter/population → observe rate-limit/cache headers → rotate token before expiry.

### 6.4 Custom domain

Upgrade to eligible plan → save one domain → create DNS TXT and CNAME records → trigger verification → verified mapping stored in Redis → call `/content/...`, `/single/...`, `/graphql`, or `/brand` on the custom host.

## 7. API documentation boundaries

`docs/04-openapi.yaml` intentionally represents the stable public integration surface, not every internal dashboard endpoint. Internal tenant routes use session cookies and evolve with the dashboard. Their method/path inventory belongs in `docs/04-API_Specification.md` and must be generated or checked against `src/app/api/tenant/**/route.ts` before release.

Known corrections applied in this baseline:

- Locales update uses `PATCH`, not `PUT`.
- Workspace settings update uses `PUT`, not `PATCH`.
- White-label update uses `PATCH`, not `PUT`.
- Domain registration/clear uses `PUT`; `POST` triggers DNS verification.
- Cron backup uses `GET`, not `POST`.
- Developer AI prompt route is `GET` in the current implementation.
- Reviewer assignment uses `GET`/`POST`; review decision uses `PATCH`.

## 8. Security invariants

1. Tenant-scoped records must be resolved with tenant ownership in the same query whenever possible.
2. API token authentication must happen before cache lookup.
3. Raw API tokens must not be persisted or used as cache/rate-limit keys.
4. Read-only tokens cannot request drafts or populate non-published relations.
5. Dedicated-DB fallback behavior must never remove the `tenantId` predicate.
6. Custom domain routing is active only after DNS verification.
7. Owner/admin-only mutations must remain enforced server-side even when the UI hides controls.
8. Synchronous hooks may reject a write; asynchronous webhook failure must not roll back the main mutation.
9. Components must not be deleted while they are still referenced by schema fields.

## 9. Documentation debt resolved by this baseline

- Removed the claim that all documents are final and production-certified.
- Separated target requirements from observed implementation status.
- Replaced conflicting `main/dev` versus `master/develop` branch guidance with repository-neutral contribution rules.
- Marked the old “Berita setup” and manual test script content as historical rather than the main user workflow.
- Corrected AI payloads, responses, access rules, and unsupported quota claims.
- Corrected White-Label methods, response fields, single-domain limit, and Redis-based routing behavior.
- Synchronized Single Type public access rules with locale fallback, cache separation, and published-only read behavior for read-only tokens.
- Added server-side component deletion guards so used components cannot be removed accidentally.
- Added one authoritative workflow document and server/UI transition rules.

## 10. Required synchronization procedure

When changing a feature:

1. Update the Prisma model or business-rule module first.
2. Update all write paths: Server Actions, Route Handlers, cron, and GraphQL mutations.
3. Update UI controls so they expose only valid operations.
4. Update API examples and OpenAPI if the public contract changed.
5. Update the relevant requirement ID and capability row in this file.
6. Record the change in Release Notes only after the implementation is present.
7. Run verification separately when the project owner authorizes test/build activity; this audit did not do so.
