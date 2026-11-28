/**
 * Scopes for SaCMS Global ("sacms-developer") MCP tokens, stored in
 * ApiToken.permissions. Every scope implies `read`.
 *
 * - read:    list/get/status/guide tools only.
 * - demo:    also write a template's internal demo content.
 * - write:   also create/update/delete Schema/Website Templates and Global
 *            Components, and redeploy demos.
 * - delete: also delete Website Templates, Schema Templates and Global Components.
 *   Deletes are a separate grant: a write token cannot remove catalog data.
 * - publish: also REQUEST publish / isDefault / cascade delete. Those still
 *            wait for a human to approve them in the dashboard
 *            (/admin/developer/approvals) — the scope only decides who may
 *            ask, never who may skip the approval.
 */
export const GLOBAL_MCP_SCOPES = ["read", "demo", "write", "delete", "publish"] as const
export type GlobalMcpScope = (typeof GLOBAL_MCP_SCOPES)[number]

export const GLOBAL_MCP_SCOPE_LABELS: Record<GlobalMcpScope, string> = {
  read: "Baca",
  demo: "Konten demo",
  write: "Ubah template",
  delete: "Hapus template",
  publish: "Ajukan publikasi",
}

/** A token minted before scopes existed carries `["schema-template"]` and
 *  keeps full access, so an existing integration doesn't break. */
const LEGACY_FULL_ACCESS = "schema-template"

export function resolveGlobalMcpScopes(permissions: unknown): GlobalMcpScope[] {
  const list = Array.isArray(permissions) ? permissions.filter((p): p is string => typeof p === "string") : []
  if (list.includes(LEGACY_FULL_ACCESS)) return [...GLOBAL_MCP_SCOPES]
  const scopes = GLOBAL_MCP_SCOPES.filter((scope) => list.includes(scope))
  if (scopes.length === 0) return []
  return scopes.includes("read") ? scopes : ["read", ...scopes]
}

const READ_TOOLS = [
  "get_builder_guide",
  "get_website_agent_workflow",
  "list_field_types",
  "list_schema_templates",
  "get_schema_template",
  "list_website_templates",
  "get_website_template",
  "get_starter_template",
  "get_website_template_demo_status",
  "get_preview_url",
  "get_website_template_preview",
  "read_preview_file",
  "get_preview_logs",
  "list_global_components",
  "get_global_component",
  "get_global_operation_status",
  "list_template_versions",
  "get_template_version",
  "get_approval_status",
  "whoami",
  "get_demo_single_type_entry",
  "list_demo_content_entries",
  "plan_demo_sample_content",
  "list_demo_sample_batches",
  "verify_demo_sample_batch",
]

// Deletes of catalog data. Separate from write, like the workspace's delete scope.
const DELETE_TOOLS = [
  "delete_website_template",
  "delete_schema_template",
  "delete_global_component",
]

const DEMO_TOOLS = [
  "sync_dev_env",
  "update_demo_single_type_entry",
  "save_demo_content_entry",
  "upload_demo_media",
  "reset_demo_content",
  "seed_demo_sample_content",
  "clear_demo_sample_batch",
]

/** Any tool not listed here requires `write` — fails closed, so a new
 *  tool can't accidentally become callable by a read-only token. */
export function requiredScopeForTool(toolName: string): GlobalMcpScope {
  if (READ_TOOLS.includes(toolName)) return "read"
  if (DEMO_TOOLS.includes(toolName)) return "demo"
  if (DELETE_TOOLS.includes(toolName)) return "delete"
  return "write"
}
