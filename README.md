# SaCMS

SaCMS is a multi-tenant headless CMS with built-in workspace billing, RBAC, AI authoring, white-label branding, custom domains, and public REST/GraphQL delivery.

If you want the canonical system overview, start with:

- [docs/00-README.md](docs/00-README.md)
- [docs/02-Software_Requirement_Specification.md](docs/02-Software_Requirement_Specification.md)
- [docs/11-User_Manual_and_Integrations.md](docs/11-User_Manual_and_Integrations.md)
- [docs/15-Implementation_Traceability.md](docs/15-Implementation_Traceability.md)

## Current canonical plan rules

Account plans limit how many workspaces a user can own:

- Free: 1 workspace
- Starter: 3 workspaces
- Pro: 10 workspaces
- Enterprise: 20 workspaces
- Custom: override via approved tenant/user override

Workspace plans limit content and platform usage:

- Free: 3 content types, 500 entries, 1 team member, 100MB storage, 1 locale, 1,000 API calls/month
- Starter: 5 content types, 5,000 entries, 3 team members, 1GB storage, 2 locales, 10,000 API calls/month
- Pro: 10 content types, 10,000 entries, 10 team members, 5GB storage, 5 locales, 100,000 API calls/month
- Enterprise: 20 content types, 20,000 entries, 20 team members, 10GB storage, 20 locales, 1,000,000 API calls/month
- Custom: override via `CustomPlanOverride`

Edge rate limiting is separate from monthly API caps:

- Free: 100 requests/minute
- Pro: 500 requests/minute
- Enterprise/Custom: configured per deployment

## Getting started

```bash
npm install
npm run db:generate
npm run db:push
npm run dev
```

## Useful scripts

- `scripts/setup-sacms.ts` — canonical setup + pricing seed
- `scripts/setup-startup-management-models.ts`
- `scripts/reseed-pricing.ts` — legacy landing-page pricing seed
- `scripts/seed-permissions.ts`

For the full runbook, deployment guidance, and API details, use the docs directory rather than this file.
