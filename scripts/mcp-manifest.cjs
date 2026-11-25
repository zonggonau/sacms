// Generates docs/mcp/tool-manifest.json: the tool names each MCP server registers.
// Run `node scripts/mcp-manifest.cjs` after adding, renaming or removing a tool.
// __tests__/api/mcp-tool-manifest.test.ts fails when the committed manifest is stale,
// so a tool change always shows up as a reviewable diff.
const fs = require("fs")
const path = require("path")

const ROOT = path.resolve(__dirname, "..")
const FILES = {
  global: "src/app/api/mcp/global-schema/[[...transport]]/route.ts",
  workspace: "src/app/api/mcp/[[...transport]]/route.ts",
  preview: "src/lib/infrastructure/mcp-preview.ts",
}

function toolNames(source) {
  const names = new Set()
  for (const m of source.matchAll(/registerTool\(\s*"([a-z_]+)"/g)) names.add(m[1])
  // Helper that registers a shared name list, e.g. registerOperationStatus("get_operation_status", ...)
  for (const m of source.matchAll(/registerOperationStatus\(\s*"([a-z_]+)"/g)) names.add(m[1])
  return [...names].sort()
}

function buildManifest(root = ROOT) {
  const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8")
  const preview = toolNames(read(FILES.preview))
  const global = [...new Set([...toolNames(read(FILES.global)), ...preview])].sort()
  const workspace = [...new Set([...toolNames(read(FILES.workspace)), ...preview])].sort()
  return { global, workspace, sharedPreview: preview }
}

module.exports = { buildManifest, toolNames }

if (require.main === module) {
  const out = path.join(ROOT, "docs/mcp/tool-manifest.json")
  fs.writeFileSync(out, JSON.stringify(buildManifest(), null, 2) + "\n")
  console.log("wrote", out)
}
