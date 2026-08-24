#!/usr/bin/env node
"use strict";
/**
 * SaCMS SDK Type Generator CLI
 * Generates TypeScript definitions from a remote SaCMS instance.
 *
 * Usage:
 *   npx @sacms/sdk generate --url http://localhost:3000 --tenant demo --token <token> --out src/types/sacms.d.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function mapFieldType(fieldType) {
    switch (fieldType) {
        case "text":
        case "richtext":
        case "string":
        case "media":
        case "date":
        case "markdown":
        case "code":
        case "color":
        case "icon":
            return "string";
        case "number":
        case "integer":
        case "float":
        case "decimal":
        case "currency":
        case "percent":
        case "rating":
            return "number";
        case "boolean":
            return "boolean";
        case "json":
        case "dynamiczone":
        case "component":
            return "Record<string, unknown> | unknown[]";
        case "relation":
            return "string | Record<string, unknown>";
        default:
            return "unknown";
    }
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
    try {
        const res = await fetch(`${url.replace(/\/+$/, "")}/api/public/${tenant}/graphql`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
                query: `
          query GetSchema {
            __schema {
              types {
                name
                kind
                fields {
                  name
                  type {
                    name
                    kind
                  }
                }
              }
            }
          }
        `,
            }),
        });
        let code = `/**
 * AUTO-GENERATED SACMS TYPE DEFINITIONS
 * Generated on: ${new Date().toISOString()}
 * Remote URL: ${url} (Tenant: ${tenant})
 */

export interface BaseEntry {
  id: string
  locale: string
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" | "REJECTED"
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SaCMSRegistry {
  collections: Record<string, BaseEntry>
  singles: Record<string, BaseEntry>
}
`;
        const resolvedOut = path_1.default.resolve(process.cwd(), outPath);
        const outDir = path_1.default.dirname(resolvedOut);
        if (!fs_1.default.existsSync(outDir)) {
            fs_1.default.mkdirSync(outDir, { recursive: true });
        }
        fs_1.default.writeFileSync(resolvedOut, code, "utf8");
        console.log(`✅ SaCMS TypeScript definitions successfully generated at: ${resolvedOut}`);
    }
    catch (err) {
        console.error(`❌ Failed to generate SaCMS types:`, err?.message || err);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
