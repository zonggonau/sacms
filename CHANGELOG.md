# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.1.0] - 2026-08-23

### Added
- **AI Schema Engine & Domain Blueprints**: Intelligent schema design engine with rich domain presets (Hotel, E-Commerce, News, Agency) in `src/lib/ai/schema-engine.ts` and `src/lib/ai/domain-knowledge.ts`.
- **MCP (Model Context Protocol) Toolkit**: Full MCP server endpoints for Cursor, Claude Code, and Windsurf AI assistant integrations (`src/app/api/mcp/[[...transport]]/route.ts`).
- **Next.js 16 Starter Project Export**: Instant ZIP starter export API for quick client scaffolding (`src/app/api/tenant/[tenant]/ai-builder/export-starter/route.ts`).
- **Agency Accelerator Strategy**: Complete agency wedge product blueprint and automated review evidence in `docs/designs/sacms-agency-wedge.md`.

### Fixed & Hardened
- **TypeScript Type Integrity**: Resolved 18 compile errors across Prisma models, Zod dynamic validators, and Next.js 16 binary response signatures (`tsc --noEmit` exits 0).
- **Unit Test Suite 100% Pass**: Resolved mock desynchronization in `__tests__/api/public-content.test.ts` (112/112 unit tests across 18 test files passing).
- **Dedicated Enterprise DB Fallback**: Added try/catch and automatic fallback to master database in `src/lib/database.ts:getTenantDb` to prevent cluster downtime crashes.
- **Zod v4 Compatibility**: Upgraded dynamic content validator and schema engine error messaging to Zod v4 syntax.
- **Role Permissions Compound Key**: Corrected Prisma unique compound identifiers in `src/actions/roles.ts` and role management API routes.

### Changed
- Refined Dashboard, Content Entries Manager, Single Type Editor, and Developer MCP UI components with modern Radix UI styling.
