// Agent-facing guidance for the SaCMS Global MCP server (/api/mcp/global-schema).
// The server's `instructions` field stays short on purpose: Claude Code cuts
// long instructions mid-sentence, so the full workflow lives in get_builder_guide.
// Bump GLOBAL_MCP_VERSION whenever a tool or a rule here changes.

export const GLOBAL_MCP_VERSION = "2.0.0"

export const GLOBAL_MCP_INSTRUCTIONS =
      "This server manages SaCMS's platform-wide template catalog ONLY — Schema Templates and Website " +
      "Templates and their linked internal demo workspaces. Customer workspaces use /api/mcp. " +
      "Call get_website_agent_workflow when building a website. Analyze the brief before creating or reusing its demo workspace. " +
      "Verify the actual demo schema before building the frontend and review security before deploying. " +
      "get_builder_guide covers the " +
      "workflow (schema+frontend build order, dry-run validation, demo preview contract, every structured " +
      "error code, and reusable Global Components via list_global_components/get_global_component). Four " +
      "rules too important to risk missing: (1) default stack for every Website Template " +
      "is Next.js + TypeScript + shadcn/ui, every component AND color token from shadcn's own system, " +
      "unless the user asks for something else; (2) call list_field_types before writing any " +
      "schema field — it has the real options/relationSlug shape per type and flags silently-ignored " +
      "options, never guess one; (3) richText field values are real HTML needing a sanitized " +
      "dangerouslySetInnerHTML in the frontend, never string interpolation, and markdown values need a " +
      "Markdown renderer, not an HTML sink; (4) for anything non-trivial, call create_website_template with " +
      "dryRun: true first — it validates the whole bundle without creating or deploying anything."
