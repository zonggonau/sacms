#!/usr/bin/env bun
/**
 * SaCMS — Unified Developer & Operations CLI Runner
 *
 * Synchronized with /docs (SDLC Guidelines, Deployment & Runbook)
 *
 * Usage:
 *   bun scripts/cli.ts <command> [arguments...]
 *   bun run cli <command>
 */
import { spawn } from "child_process";
import path from "path";

interface CommandDefinition {
  script: string;
  category: "Seed" | "Migration" | "Core & Ops" | "QA & Tests" | "Database & Shell";
  description: string;
  usage?: string;
}

const COMMANDS: Record<string, CommandDefinition> = {
  // ─── Seeding & Setup ───
  "seed:global": {
    script: "scripts/seed/seed-all-global.ts",
    category: "Seed",
    description: "Seed master content types, components & landing data",
  },
  "seed:permissions": {
    script: "scripts/seed/seed-permissions.ts",
    category: "Seed",
    description: "Seed global RBAC permissions and default role matrix",
  },
  "seed:workflow": {
    script: "scripts/seed/seed-workflow-permissions.ts",
    category: "Seed",
    description: "Seed content workflow transition permissions (Doc 14)",
  },
  "seed:plans": {
    script: "scripts/seed/seed-plans.ts",
    category: "Seed",
    description: "Seed default subscription and workspace plans",
  },
  "seed:sacms": {
    script: "scripts/seed/setup-sacms.ts",
    category: "Seed",
    description: "Initialize canonical SaCMS content models & components",
  },
  "seed:clear": {
    script: "scripts/seed/clear-global.ts",
    category: "Seed",
    description: "Wipe sacms-global content entries for a clean reseed",
  },

  // ─── Migrations & Database ───
  "migrate:tenant": {
    script: "scripts/migrate/push-tenant-schema.ts",
    category: "Migration",
    description: "Push Prisma schema to dedicated tenant database",
    usage: "<slug|id|--all>",
  },
  "migrate:media": {
    script: "scripts/migrate/migrate-local-media.ts",
    category: "Migration",
    description: "Migrate local media to MinIO / Cloudflare R2",
    usage: "[--apply]",
  },
  "migrate:domains": {
    script: "scripts/migrate/migrate-domains.ts",
    category: "Migration",
    description: "Migrate legacy domains into CustomDomain table",
  },
  "migrate:fts": {
    script: "scripts/migrate/setup-fts.ts",
    category: "Migration",
    description: "Setup PostgreSQL Full-Text Search trigger & GIN index",
  },
  "migrate:backfill-owners": {
    script: "scripts/migrate/backfill-owner-slugs.ts",
    category: "Migration",
    description: "Backfill ownerSlug and associate workspace ownerId",
  },

  // ─── Core / Operations ───
  "cron:publish": {
    script: "scripts/core/scheduled-publish.ts",
    category: "Core & Ops",
    description: "Execute scheduled content publishing worker",
    usage: "[--dry-run]",
  },
  "auth:rotate-key": {
    script: "scripts/core/update-api-key.ts",
    category: "Core & Ops",
    description: "Rotate platform systemApiKey safely in the database",
  },

  // ─── QA & Tests ───
  "qa:audit": {
    script: "scripts/qa/qa-runner.ts",
    category: "QA & Tests",
    description: "Run route-by-route audit with latency metrics",
    usage: "[baseUrl]",
  },
  "qa:security": {
    script: "scripts/qa/qa-security-smoke.ts",
    category: "QA & Tests",
    description: "Run security smoke test suite (SSRF, auth gates)",
  },
  "sdk:generate": {
    script: "scripts/qa/generate-sdk-types.ts",
    category: "QA & Tests",
    description: "Generate TypeScript SDK interfaces from schema models",
  },

  // ─── Database & DevOps Shell ───
  "db:backup": {
    script: "scripts/shell/db-backup.sh",
    category: "Database & Shell",
    description: "Run PostgreSQL pg_dump with 7-day rotation (Doc 08)",
    usage: "[output_dir]",
  },
  "db:restore": {
    script: "scripts/shell/db-restore.sh",
    category: "Database & Shell",
    description: "Restore PostgreSQL database from dump file",
    usage: "<backup_file>",
  },
};

function printHelp() {
  console.log("");
  console.log("==================================================================");
  console.log("⚡ SaCMS — Unified Developer & Operational CLI Runner");
  console.log("==================================================================");
  console.log("Usage: bun run cli <command> [options]");
  console.log("");

  const categories = ["Seed", "Migration", "Core & Ops", "QA & Tests", "Database & Shell"] as const;

  for (const cat of categories) {
    console.log(`📁 ${cat}:`);
    for (const [name, def] of Object.entries(COMMANDS)) {
      if (def.category === cat) {
        const usage = def.usage ? ` ${def.usage}` : "";
        const formattedName = name.padEnd(25);
        console.log(`   ${formattedName} ${def.description}${usage}`);
      }
    }
    console.log("");
  }

  console.log("==================================================================");
  console.log("Examples:");
  console.log("  bun run cli seed:global");
  console.log("  bun run cli migrate:tenant demo");
  console.log("  bun run cli qa:audit http://localhost:3000");
  console.log("  bun run cli cron:publish");
  console.log("  bun run cli db:backup");
  console.log("==================================================================");
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  const commandName = args[0];
  const commandArgs = args.slice(1);

  if (!commandName || commandName === "help" || commandName === "--help" || commandName === "-h") {
    printHelp();
    return;
  }

  const command = COMMANDS[commandName];
  if (!command) {
    console.error(`❌ Unknown command: '${commandName}'`);
    printHelp();
    process.exit(1);
  }

  const targetScript = path.resolve(process.cwd(), command.script);
  console.log(`🚀 Executing [${commandName}]: ${command.script} ${commandArgs.join(" ")}\n`);

  // Detect shell scripts vs JavaScript/TypeScript
  const isShellScript = targetScript.endsWith(".sh");
  const execCmd = isShellScript ? "bash" : "bun";

  const child = spawn(execCmd, [targetScript, ...commandArgs], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error("CLI Fatal Error:", err);
  process.exit(1);
});
