#!/usr/bin/env node
"use strict";
/**
 * SaCMS SDK Type Generator CLI
 * Generates TypeScript definitions from a remote SaCMS instance's real
 * GraphQL schema, via standard introspection — works against any SaCMS
 * instance the token can reach, no local database access needed.
 *
 * Usage:
 *   npx @sacms/sdk generate --url http://localhost:3000 --tenant demo --token <token> --out src/types/sacms.d.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unwrap = unwrap;
exports.scalarToTs = scalarToTs;
exports.buildInterface = buildInterface;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const INTROSPECTION_QUERY = `
  query SaCMSSdkIntrospection {
    __schema {
      queryType {
        fields {
          name
          type { kind name ofType { kind name ofType { kind name } } }
        }
      }
      types {
        name
        kind
        fields {
          name
          type { kind name ofType { kind name ofType { kind name } } }
        }
      }
    }
  }
`;
/** Unwraps NON_NULL/LIST wrappers to the innermost named type, and whether the field is required. */
function unwrap(ref) {
    let cur = ref;
    let required = false;
    if (cur.kind === "NON_NULL") {
        required = true;
        cur = cur.ofType;
    }
    while (cur && (cur.kind === "LIST" || cur.kind === "NON_NULL")) {
        cur = cur.ofType;
    }
    return { name: cur?.name ?? "Unknown", required };
}
function scalarToTs(name) {
    switch (name) {
        case "String":
        case "ID":
            return "string";
        case "Int":
        case "Float":
            return "number";
        case "Boolean":
            return "boolean";
        case "JSON":
            return "Record<string, unknown> | unknown[]";
        default:
            return "unknown";
    }
}
/** Emits one `export interface TypeName { ... }` from a real introspected object type. */
function buildInterface(typeName, type) {
    const fields = (type.fields ?? [])
        .map((f) => {
        const { name, required } = unwrap(f.type);
        return `  ${f.name}${required ? "" : "?"}: ${scalarToTs(name)}`;
    })
        .join("\n");
    return `export interface ${typeName} {\n${fields}\n}\n\n`;
}
async function main() {
    const args = process.argv.slice(2);
    let url = "http://localhost:3000";
    let tenant = "global";
    let token = "";
    let outPath = "./sacms.d.ts";
    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--url" && args[i + 1])
            url = args[++i];
        if (args[i] === "--tenant" && args[i + 1])
            tenant = args[++i];
        if (args[i] === "--token" && args[i + 1])
            token = args[++i];
        if (args[i] === "--out" && args[i + 1])
            outPath = args[++i];
    }
    console.log(`📡 Fetching SaCMS schema from ${url} (Tenant: ${tenant})...`);
    const res = await fetch(`${url.replace(/\/+$/, "")}/api/public/${tenant}/graphql`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: INTROSPECTION_QUERY }),
    });
    const json = (await res.json().catch(() => null));
    if (!res.ok || !json?.data) {
        const message = json?.errors?.[0]?.message ?? `HTTP ${res.status}`;
        console.error(`❌ Failed to fetch schema from ${url}: ${message}`);
        process.exit(1);
    }
    const { queryType, types } = json.data.__schema;
    const typesByName = new Map(types.filter((t) => t.kind === "OBJECT" && !t.name.startsWith("__")).map((t) => [t.name, t]));
    let body = "";
    const collectionEntries = [];
    const singleEntries = [];
    for (const field of queryType.fields) {
        // `${slug}ById` is the by-id lookup variant of a collection field — the
        // registry only needs the plain, slug-named query field.
        if (field.name.endsWith("ById"))
            continue;
        const { name: returnTypeName } = unwrap(field.type);
        if (returnTypeName.endsWith("Collection")) {
            // A Content Type's query field returns `${TypeName}Collection`, which
            // wraps `data: [${TypeName}!]!` — the real entry shape (id, locale,
            // status, publishedAt, createdAt, updatedAt, and every custom field)
            // lives on `${TypeName}` itself, introspected directly rather than
            // assumed from a hand-written base interface.
            const itemTypeName = returnTypeName.slice(0, -"Collection".length);
            const itemType = typesByName.get(itemTypeName);
            if (!itemType)
                continue;
            body += buildInterface(itemTypeName, itemType);
            collectionEntries.push(`    "${field.name}": ${itemTypeName}`);
        }
        else if (returnTypeName.endsWith("Single")) {
            // A Single Type's query field returns `${TypeName}Single` directly —
            // unlike a collection entry, it has no id/locale/status/createdAt,
            // only publishedAt/updatedAt plus its custom fields (see
            // src/lib/graphql-schema.ts's Single Type generation and the real
            // REST response in src/app/api/public/[tenant]/single/[singleType]).
            const singleType = typesByName.get(returnTypeName);
            if (!singleType)
                continue;
            body += buildInterface(returnTypeName, singleType);
            singleEntries.push(`    "${field.name}": ${returnTypeName}`);
        }
    }
    const code = `/**
 * AUTO-GENERATED SACMS TYPE DEFINITIONS — DO NOT EDIT DIRECTLY
 * Generated on: ${new Date().toISOString()}
 * Remote URL: ${url} (Tenant: ${tenant})
 */

${body}export interface SaCMSRegistry {
  collections: {
${collectionEntries.join(";\n") || "    [slug: string]: Record<string, unknown>"}
  }
  singles: {
${singleEntries.join(";\n") || "    [slug: string]: Record<string, unknown>"}
  }
}
`;
    const resolvedOut = path_1.default.resolve(process.cwd(), outPath);
    const outDir = path_1.default.dirname(resolvedOut);
    if (!fs_1.default.existsSync(outDir)) {
        fs_1.default.mkdirSync(outDir, { recursive: true });
    }
    fs_1.default.writeFileSync(resolvedOut, code, "utf8");
    console.log(`✅ Generated ${collectionEntries.length} collection type(s) and ${singleEntries.length} single type(s) at: ${resolvedOut}`);
}
if (require.main === module) {
    main().catch((err) => {
        console.error(`❌ Failed to generate SaCMS types:`, err?.message || err);
        process.exit(1);
    });
}
