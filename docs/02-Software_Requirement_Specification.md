# Software Requirement Specification (SRS)

**Product:** SaCMS — Multi-tenant SaaS Headless CMS  
**Baseline:** 19 June 2026  
**Status:** Living specification; implementation traceability is maintained in document 15

## 1. Purpose and conventions

This specification defines required product behavior. Requirement keywords are interpreted as follows:

- **MUST:** mandatory runtime invariant.
- **SHOULD:** expected behavior; exceptions require a documented reason.
- **MAY:** optional capability.

Implementation status is not inferred from the wording of a requirement. See [15-Implementation_Traceability.md](./15-Implementation_Traceability.md) for observed implementation and constraints.

## 2. Product scope

SaCMS provides:

- User authentication and workspace membership.
- Shared or dedicated-database multi-tenancy.
- Dynamic Collection Types, Single Types, Components, and fields.
- Content authoring, localization, review, scheduling, publication, archive, and history.
- Media management backed by S3-compatible Cloudflare R2.
- Public REST and GraphQL content delivery.
- API tokens, rate limiting, caching, audit trail, webhooks, import/export, and SDK support.
- Workspace subscription/billing and plan limits.
- Optional AI, White-Label, and Custom Domain capabilities.

## 3. Actors and authorization model

| Actor | Identifier | Scope | Core responsibility |
|---|---|---|---|
| Platform administrator | `super_admin` | Platform | Manage global schemas, tenants, users, billing, and monitoring |
| Workspace owner | `owner` | Tenant | Full workspace control and billing ownership |
| Workspace administrator | `admin` | Tenant | Manage schema, content, members, integrations, and settings |
| Content editor | `editor` | Tenant | Create/edit content and participate in permitted workflow transitions |
| Contributor | `member` | Tenant | Create drafts and submit for review when permitted |
| Read-only user | `viewer` | Tenant | Read workspace content without mutation |
| API client | API token | Tenant | Read or mutate through the public integration surface according to token type |
| Scheduler | `system` | Platform/tenant job | Publish due scheduled content and retry background delivery |

A reviewer is not a permanent built-in role. A reviewer is an eligible tenant member assigned to one entry through `ContentReviewAssignment`.

## 4. Functional requirements

### 4.1 Identity and session

| ID | Requirement |
|---|---|
| FR-AUTH-001 | The system MUST support credentials authentication with bcrypt password hashing. |
| FR-AUTH-002 | A credentials user MUST verify email before completing sign-in. |
| FR-AUTH-003 | Google and GitHub OAuth MAY be enabled when provider credentials exist. |
| FR-AUTH-004 | The authenticated session MUST expose user ID, platform role, account plan, and tenant memberships. |
| FR-AUTH-005 | A super admin MUST be able to resolve any tenant without a membership row while preserving tenant scoping. |

### 4.2 Workspace lifecycle and plans

| ID | Requirement |
|---|---|
| FR-TEN-001 | An authenticated user MUST be able to create/select a workspace subject to account plan limits. |
| FR-TEN-002 | Every tenant MUST have a globally unique slug. |
| FR-TEN-003 | Workspace mutations MUST resolve access using tenant ID or slug and current user membership. |
| FR-TEN-004 | The system MUST enforce limits for content types, entries, team members, storage, locales, API calls, and user workspaces where configured. |
| FR-TEN-005 | A super admin MAY configure per-user or per-tenant plan overrides. |
| FR-TEN-006 | A tenant MAY use a dedicated PostgreSQL URL; otherwise it MUST use the shared database with `tenantId` isolation. |

Canonical workspace limits are defined in `src/lib/tenant-plan.ts`. Dynamic published pricing content may override the fallback values used at runtime.

### 4.3 Schema modeling

| ID | Requirement |
|---|---|
| FR-SCH-001 | Owner/admin MUST be able to define tenant Collection Types, Single Types, Components, and ordered fields. |
| FR-SCH-002 | Global schemas MAY be assigned to selected tenants without duplicating the global definition. |
| FR-SCH-003 | Content Type, Single Type, and Component definitions SHOULD use the canonical `SchemaField` model. |
| FR-SCH-004 | A field MUST have a stable slug and type and MAY define required, unique, localizable, relation, JSON-path, order, and options metadata. |
| FR-SCH-005 | Component deletion SHOULD warn when the component is referenced by another schema. |
| FR-SCH-006 | Creating schema resources MUST respect plan limits. |

Supported renderer/validator types currently include text, textarea/markdown, rich text, slug/UID, email, integer/number, boolean, date/datetime, select, JSON/color/location, media, multiple media, relation, component, tags, file, and document-template-specific behavior.

### 4.4 Collection content lifecycle

| ID | Requirement |
|---|---|
| FR-CNT-001 | Authorized users MUST be able to create, read, update, and delete Collection entries. |
| FR-CNT-002 | The canonical statuses MUST be `DRAFT`, `IN_REVIEW`, `APPROVED`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`, and `REJECTED`. |
| FR-CNT-003 | Status changes MUST follow the state machine and role/custom permissions in document 14. |
| FR-CNT-004 | A `DRAFT` MAY omit required fields; leaving draft MUST enforce all required fields. |
| FR-CNT-005 | A `SCHEDULED` entry MUST have a valid future publication date. |
| FR-CNT-006 | Every create/update and scheduler publication SHOULD create a content version snapshot. |
| FR-CNT-007 | Delete MUST be restricted to owner/admin and MUST remain tenant-scoped. |
| FR-CNT-008 | Publishing MUST set `publishedAt`; editing an already published item MUST NOT reset it unless a new publish transition occurs. |
| FR-CNT-009 | Unpublish MUST return content to `DRAFT` and remove it from read-only Public API results. |

Detailed lifecycle and side effects are normative in [14-Content_Workflow_and_Approval.md](./14-Content_Workflow_and_Approval.md).

### 4.5 Review and approval

| ID | Requirement |
|---|---|
| FR-REV-001 | Owner/admin MUST be able to assign an ordered reviewer chain while an entry is Draft or In Review. |
| FR-REV-002 | Every reviewer MUST be a non-viewer member of the same tenant with `content.read`. |
| FR-REV-003 | A reviewer MUST NOT act before all lower-order pending reviewers finish. |
| FR-REV-004 | Final sequential approval MUST move the entry to `APPROVED`; owner/admin MAY use the explicit audited status override. |
| FR-REV-005 | Any rejection MUST move the entry to `REJECTED`. |
| FR-REV-006 | Review decisions SHOULD accept an optional comment and MUST be audited. |

### 4.6 Localization

| ID | Requirement |
|---|---|
| FR-I18N-001 | A tenant MUST define enabled locales and at most one default locale. |
| FR-I18N-002 | Collection translations MUST share a logical `documentId`. |
| FR-I18N-003 | Localizable fields MUST vary by locale; non-localizable fields MUST remain synchronized across variants. |
| FR-I18N-004 | Locale creation MUST respect the workspace plan limit. |
| FR-I18N-005 | API clients MAY select locale using `?locale=`. |

### 4.7 Media

| ID | Requirement |
|---|---|
| FR-MED-001 | Authorized users MUST be able to list, upload, update metadata, retrieve, and delete media within their tenant. |
| FR-MED-002 | Media MUST retain tenant ID, MIME type, size, storage key, URL, and audit metadata where available. |
| FR-MED-003 | Supported images SHOULD receive thumbnail and medium variants. |
| FR-MED-004 | Upload MUST enforce storage plan capacity and server-side file constraints. |
| FR-MED-005 | Private media MUST be served through an authorized path rather than assumed publicly accessible. |

### 4.8 Public REST API

| ID | Requirement |
|---|---|
| FR-REST-001 | Collection reads MUST require `Authorization: Bearer <token>`. |
| FR-REST-002 | The token tenant MUST match the tenant in the route. |
| FR-REST-003 | Read-only tokens MUST only receive `PUBLISHED` entries and published populated relations. |
| FR-REST-004 | Full-access tokens MAY query another valid workflow status. |
| FR-REST-005 | Collection list MUST support page/pageSize, locale, sort, fields, populate, search, and approved filter operators. |
| FR-REST-006 | Page size MUST be capped at 100. |
| FR-REST-007 | Authentication and authorization MUST complete before a cached response is returned. |
| FR-REST-008 | API responses SHOULD include pagination and rate-limit metadata. |

### 4.9 GraphQL API

| ID | Requirement |
|---|---|
| FR-GQL-001 | The schema MUST be generated from tenant-available Content Types and Single Types. |
| FR-GQL-002 | Queries MUST be available to a valid tenant API token. |
| FR-GQL-003 | Mutations MUST require token type `full-access`. |
| FR-GQL-004 | Entry mutation resolvers MUST enforce tenant ownership, hooks, audit logging, and workflow rules where status changes occur. |

### 4.10 API tokens

| ID | Requirement |
|---|---|
| FR-TOK-001 | Owner/admin MUST be able to create and revoke tenant API tokens. |
| FR-TOK-002 | The plaintext token MUST be shown only in the creation response. |
| FR-TOK-003 | Only the SHA-256 token hash MUST be persisted. |
| FR-TOK-004 | Expired tokens MUST be rejected. |
| FR-TOK-005 | Token types MUST include `read-only` and `full-access`. |

### 4.11 Webhooks and hooks

| ID | Requirement |
|---|---|
| FR-WEB-001 | Tenant owner/admin MUST be able to configure webhook URL, events, type, secret, headers, and enabled state. |
| FR-WEB-002 | Synchronous hooks MAY reject or replace mutation data before persistence. |
| FR-WEB-003 | Async webhook failure MUST NOT roll back the primary content mutation. |
| FR-WEB-004 | Failed async delivery MUST be logged and queued for retry. |
| FR-WEB-005 | Signed hooks MUST use HMAC-SHA256 over the serialized payload. |
| FR-WEB-006 | Retry processing MUST stop after the configured maximum attempts and retain exhausted records. |

### 4.12 Billing and subscription

| ID | Requirement |
|---|---|
| FR-BIL-001 | The dashboard MUST expose available plans, current subscription, invoice history, and usage. |
| FR-BIL-002 | Checkout MUST use the configured payment provider. |
| FR-BIL-003 | Midtrans notification handling MUST update transaction/subscription state based on verified provider data. |
| FR-BIL-004 | Upgrade/downgrade/cancel operations MUST verify tenant ownership. |
| FR-BIL-005 | Plan changes MUST propagate to enforcement paths. |

### 4.13 AI authoring

| ID | Requirement |
|---|---|
| FR-AI-001 | AI routes MUST require provider configuration, session, tenant access, and feature enablement. |
| FR-AI-002 | AI schema/component/single-type generation MUST require owner/admin. |
| FR-AI-003 | AI output MUST NOT bypass content validation or workflow. |
| FR-AI-004 | Provider errors SHOULD use bounded retry and model fallback. |
| FR-AI-005 | Users MUST be informed that prompt data is sent to an external provider. |

### 4.14 White-Label and Custom Domain

| ID | Requirement |
|---|---|
| FR-WL-001 | Pro, Enterprise, and Custom workspaces MAY configure branding. |
| FR-WL-002 | Only owner/admin MAY mutate branding or domains. |
| FR-WL-003 | A tenant MAY have at most one unique custom domain. |
| FR-WL-004 | A custom domain MUST pass DNS TXT verification before routing is activated. |
| FR-WL-005 | Custom-host requests MUST still pass Public API token and tenant checks. |

## 5. Business rules

| ID | Rule |
|---|---|
| BR-001 | No tenant-scoped query may trust an entry/member/media ID without checking tenant ownership. |
| BR-002 | Global schemas are usable only when globally available or explicitly enabled for the tenant. |
| BR-003 | Plan enforcement is evaluated before resource creation, not after the limit is exceeded. |
| BR-004 | Plain API tokens and credentials must never be written to application logs. |
| BR-005 | Sync hook rejection is authoritative; async delivery is best-effort with durable retry state. |
| BR-006 | Public cache namespaces must be invalidated after content writes that can affect an API response. |
| BR-007 | A custom permission array is an explicit workflow override for non-owner/admin roles. |
| BR-008 | Server authorization is authoritative; hiding a UI control is never sufficient protection. |

## 6. Security requirements

| ID | Requirement |
|---|---|
| SEC-001 | Passwords MUST use bcrypt with configured salt rounds; legacy hashes may only be accepted for migration and MUST be rehashed after successful login. |
| SEC-002 | Session cookies MUST be secure in production and inaccessible to client-side scripts. |
| SEC-003 | Public and internal APIs MUST enforce rate limits appropriate to their surface. |
| SEC-004 | Dynamic filter values MUST be parameterized; field/operator names MUST come from allowlists. |
| SEC-005 | Route bodies SHOULD be validated with Zod or an equivalent explicit validator. |
| SEC-006 | File upload MUST validate size and MIME behavior before storage. |
| SEC-007 | Cron endpoints MUST require `CRON_SECRET`. |
| SEC-008 | Security headers MUST be applied by `src/proxy.ts`. |
| SEC-009 | CORS policy MUST be documented accurately; the current Public API policy is `*`, not an origin allowlist. |

## 7. Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Availability | Production target is 99.5%; measurement requires external uptime monitoring. |
| NFR-002 | Performance | Public collection reads target P95 below 200 ms for representative indexed workloads; this remains a measured acceptance target, not a static-code guarantee. |
| NFR-003 | Scalability | Distributed rate limiting/cache SHOULD use Redis; process-local fallback is degradation mode only. |
| NFR-004 | Maintainability | Business rules SHOULD be centralized in pure modules shared by server and client where safe. |
| NFR-005 | Observability | Failures SHOULD include structured server logs and MAY report to Sentry when configured. |
| NFR-006 | Recoverability | Database and media backup procedures MUST be documented and periodically verified by operations. |
| NFR-007 | Compatibility | The application targets Next.js 16, React 19, PostgreSQL, and Prisma 6 according to `package.json`. |
| NFR-008 | Accessibility | Dashboard interactions SHOULD remain keyboard-operable and expose labels/status text beyond color alone. |

## 8. Acceptance and verification policy

An item may be marked “implemented” in document 15 after a complete code path is statically present. It may only be marked “verified” after the project owner authorizes and records the appropriate test/build/manual acceptance activity.

The 19 June 2026 synchronization intentionally performed no test, build, lint, migration, or external integration calls.
