// Generates docs/mcp/tool-reference.md: every workspace and global MCP tool with its
// description and hints, read from the source. Run `node scripts/mcp-tool-reference.cjs`
// after adding or renaming a tool; __tests__/api/mcp-tool-reference.test.ts fails when stale.
const fs = require("fs")
const path = require("path")
const { buildManifest } = require("./mcp-manifest.cjs")

const ROOT = path.resolve(__dirname, "..")
const OUT = path.join(ROOT, "docs", "mcp", "tool-reference.md")

const SOURCES = {
  workspace: { dir: "src/lib/mcp/workspace", extra: ["src/lib/infrastructure/mcp-preview.ts"] },
  global: { dir: "src/lib/mcp/global", extra: ["src/lib/infrastructure/mcp-preview.ts"] },
}

function readSources({ dir, extra }) {
  const abs = path.join(ROOT, dir)
  const files = fs.existsSync(abs)
    ? fs.readdirSync(abs).filter((f) => f.endsWith(".ts") && !f.includes("generated")).map((f) => path.join(abs, f))
    : []
  for (const f of extra) files.push(path.join(ROOT, f))
  return files.map((f) => fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n")).join("\n")
}

// Source of one registerTool(...) call: from its name up to the next registration.
function blockFor(source, name) {
  const re = new RegExp(`registerTool\\(\\s*"${name}"`)
  const m = re.exec(source)
  if (!m) return ""
  const rest = source.slice(m.index + m[0].length)
  const next = rest.search(/registerTool\(/)
  return next === -1 ? rest : rest.slice(0, next)
}

// Value of a `const name = ...` declared in the sources, or "" when there is none.
function constantValue(name, source) {
  const c = new RegExp(`const ${name}\\s*=\\s*([\\s\\S]*?)(?:;|\\n)`).exec(source)
  return c ? stringsOf(c[1], source) : ""
}

// Joins the string literals in an expression ("a" + "b", template strings); ${name} resolves to a constant.
function stringsOf(expr, source = "") {
  const parts = [...expr.matchAll(/"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((x) => x[1] ?? x[2])
  return parts
    .join("")
    .replace(/\$\{(\w+)\}/g, (_, n) => constantValue(n, source))
    .replace(/\\"/g, '"')
    .replace(/\\`/g, "`")
    .replace(/\s+/g, " ")
    .trim()
}

// Description of a registration: an inline string (possibly concatenated), or a named constant
// defined in the same sources (preview tools use `startDescription`).
function descriptionOf(block, source) {
  const m = /description:\s*([\s\S]*?)(?=,\s*(?:inputSchema|outputSchema|annotations|title|_meta)\s*:|\n\s*\})/.exec(block)
  if (!m) return ""
  const expr = m[1]
  const literal = stringsOf(expr, source)
  if (literal) return literal
  const ident = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(expr.split(",")[0])
  return ident ? constantValue(ident[1], source) : ""
}

// Tools registered through the shared alias helper: registerOperationStatus("name", "description", ...).
function aliasDescriptionOf(source, name) {
  const m = new RegExp(`registerOperationStatus\\(\\s*"${name}"\\s*,\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(source)
  return m ? m[1].replace(/\s+/g, " ").trim() : ""
}

function hintsOf(block) {
  const m = /annotations:\s*\{([^}]*)\}/.exec(block)
  if (!m) return "not annotated"
  const v = (k) => new RegExp(`${k}:\\s*(true|false)`).exec(m[1])?.[1] === "true"
  const tags = []
  if (v("readOnlyHint")) tags.push("read-only")
  if (v("destructiveHint")) tags.push("destructive")
  if (v("openWorldHint")) tags.push("external")
  return tags.join(", ") || "write"
}

function escapeCell(s) {
  return s.replace(/\|/g, "\\|")
}

function buildReference(root = ROOT) {
  const manifest = buildManifest(root)
  const lines = [
    "# MCP tool reference",
    "",
    "Generated from the server source by `scripts/mcp-tool-reference.cjs`. Do not edit by hand;",
    "run `node scripts/mcp-tool-reference.cjs` after adding, renaming, or changing a tool.",
    "",
    "The hints column comes from each tool's MCP annotations: `read-only` tools change nothing,",
    "`destructive` tools delete or roll back data, and `external` tools call a system outside SaCMS.",
    "",
  ]
  for (const server of ["workspace", "global"]) {
    const source = readSources(SOURCES[server])
    lines.push(`## ${server === "workspace" ? "Workspace MCP (`/api/mcp`)" : "Global MCP (`/api/mcp/global-schema`)"}`, "")
    lines.push(`${manifest[server].length} tools.`, "")
    lines.push("| Tool | Hints | Description |", "| --- | --- | --- |")
    for (const name of manifest[server]) {
      const block = blockFor(source, name)
      const desc = descriptionOf(block, source) || aliasDescriptionOf(source, name) || "(no description)"
      // Tools registered through the shared status helper carry its read-only annotation (see website-template-tools.ts).
      const hints = !block && aliasDescriptionOf(source, name) ? "read-only" : hintsOf(block)
      lines.push(`| \`${name}\` | ${hints} | ${escapeCell(desc)} |`)
    }
    lines.push("")
  }
  return lines.join("\n")
}

if (require.main === module) {
  fs.writeFileSync(OUT, buildReference())
  console.log(`wrote ${path.relative(ROOT, OUT)}`)
}

module.exports = { buildReference, OUT }
