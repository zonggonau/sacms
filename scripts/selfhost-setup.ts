#!/usr/bin/env node
/**
 * SaCMS Self-Hosted Setup Script
 * 
 * Run: bunx tsx scripts/selfhost-setup.ts
 * 
 * This script:
 * 1. Checks prerequisites
 * 2. Generates .env file interactively
 * 3. Runs Prisma migrations
 * 4. Seeds default admin user
 * 5. Seeds global content types & templates
 */

import { createInterface } from "readline"
import { execSync, spawnSync } from "child_process"
import { existsSync, writeFileSync, readFileSync } from "fs"
import { randomBytes, randomUUID } from "crypto"
import path from "path"

// ─── ANSI Colors ─────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
}

function log(msg: string) { console.log(msg) }
function info(msg: string) { console.log(`${c.blue}ℹ${c.reset} ${msg}`) }
function success(msg: string) { console.log(`${c.green}✅${c.reset} ${msg}`) }
function warn(msg: string) { console.log(`${c.yellow}⚠${c.reset} ${msg}`) }
function error(msg: string) { console.log(`${c.red}✖${c.reset} ${msg}`) }

// ─── Readline Helper ─────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout })

function ask(question: string, defaultVal = ""): Promise<string> {
  const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : ""
  return new Promise((resolve) => {
    rl.question(`${c.cyan}?${c.reset} ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal)
    })
  })
}

function askYesNo(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? "Y/n" : "y/N"
  return new Promise((resolve) => {
    rl.question(`${c.cyan}?${c.reset} ${question} ${c.dim}(${hint})${c.reset}: `, (answer) => {
      if (!answer.trim()) resolve(defaultYes)
      else resolve(answer.toLowerCase().startsWith("y"))
    })
  })
}

// ─── Main Setup Flow ─────────────────────────────────────────────────
async function main() {
  log("")
  log(`${c.bold}${c.magenta}╔════════════════════════════════════════════════╗${c.reset}`)
  log(`${c.bold}${c.magenta}║                                                ║${c.reset}`)
  log(`${c.bold}${c.magenta}║     🚀 SaCMS Self-Hosted Setup                ║${c.reset}`)
  log(`${c.bold}${c.magenta}║     Enterprise Headless CMS                   ║${c.reset}`)
  log(`${c.bold}${c.magenta}║                                                ║${c.reset}`)
  log(`${c.bold}${c.magenta}╚════════════════════════════════════════════════╝${c.reset}`)
  log("")
  info("This wizard will configure your self-hosted SaCMS instance.")
  log("")

  // ─── Step 1: Check prerequisites ────────────────────────────────
  log(`${c.bold}Step 1/5: Checking prerequisites...${c.reset}`)

  // Check Bun/Node
  try {
    const bunVersion = execSync("bun --version", { stdio: "pipe" }).toString().trim()
    success(`Bun v${bunVersion} detected`)
  } catch {
    try {
      const nodeVersion = execSync("node --version", { stdio: "pipe" }).toString().trim()
      success(`Node ${nodeVersion} detected`)
      warn("Bun recommended for better performance. Install: https://bun.sh")
    } catch {
      error("Neither Bun nor Node.js found. Please install one first.")
      process.exit(1)
    }
  }

  // Check if package.json exists (are we in the right directory?)
  if (!existsSync("package.json")) {
    error("package.json not found. Please run this script from the SaCMS project root.")
    process.exit(1)
  }

  log("")

  // ─── Step 2: Database Configuration ─────────────────────────────
  log(`${c.bold}Step 2/5: Database Configuration${c.reset}`)
  
  let dbUrl = await ask(
    "PostgreSQL connection URL",
    "postgresql://sacms:sacms@localhost:5432/sacms"
  )

  // Quick DB connection test
  info("Testing database connection...")
  try {
    const testResult = spawnSync("bun", [
      "-e",
      `const { Client } = require('pg'); const c = new Client('${dbUrl}'); c.connect().then(() => { console.log('OK'); c.end(); }).catch(e => { console.error(e.message); process.exit(1); })`,
    ], { stdio: "pipe", timeout: 10000 })

    if (testResult.status === 0) {
      success("Database connection successful")
    } else {
      warn("Could not verify database connection. Make sure PostgreSQL is running.")
      const proceed = await askYesNo("Continue anyway?", true)
      if (!proceed) process.exit(1)
    }
  } catch {
    warn("Could not test database connection (pg not installed yet). Continuing...")
  }

  log("")

  // ─── Step 3: Application Configuration ──────────────────────────
  log(`${c.bold}Step 3/5: Application Configuration${c.reset}`)

  const appUrl = await ask("Application URL", "http://localhost:3000")
  const nextAuthSecret = randomBytes(32).toString("hex")
  const cronSecret = randomBytes(16).toString("hex")

  // Optional: License key
  const licenseKey = await ask("Enterprise License Key (optional, press Enter to skip)", "")

  // Optional: S3/R2 Storage
  const configStorage = await askYesNo("Configure S3/R2 cloud storage? (No = local storage)", false)
  
  let s3Config = {
    endpoint: "",
    region: "auto",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    publicUrl: "",
  }

  if (configStorage) {
    s3Config.endpoint = await ask("S3 Endpoint URL")
    s3Config.region = await ask("S3 Region", "auto")
    s3Config.accessKeyId = await ask("S3 Access Key ID")
    s3Config.secretAccessKey = await ask("S3 Secret Access Key")
    s3Config.bucket = await ask("S3 Bucket Name")
    s3Config.publicUrl = await ask("S3 Public URL (for serving media)")
  }

  log("")

  // ─── Step 4: Generate .env file ─────────────────────────────────
  log(`${c.bold}Step 4/5: Generating configuration files...${c.reset}`)

  const envContent = `# SaCMS Self-Hosted Configuration
# Generated by selfhost-setup.ts on ${new Date().toISOString()}

# ─── Self-Hosted Mode ───────────────────────────
SELFHOST_MODE="true"

# ─── Database ───────────────────────────────────
DATABASE_URL="${dbUrl}"

# ─── NextAuth ───────────────────────────────────
NEXTAUTH_SECRET="${nextAuthSecret}"
NEXTAUTH_URL="${appUrl}"

# ─── Cron Jobs ──────────────────────────────────
CRON_SECRET="${cronSecret}"

# ─── Enterprise License (optional) ──────────────
LICENSE_KEY="${licenseKey}"
LICENSE_SERVER_URL="https://license.sacms.cloud"

# ─── S3/R2 Storage ──────────────────────────────
S3_ENDPOINT="${s3Config.endpoint}"
S3_REGION="${s3Config.region}"
S3_ACCESS_KEY_ID="${s3Config.accessKeyId}"
S3_SECRET_ACCESS_KEY="${s3Config.secretAccessKey}"
S3_BUCKET="${s3Config.bucket}"
S3_PUBLIC_URL="${s3Config.publicUrl}"

# ─── Redis (optional) ──────────────────────────
# Uncomment and configure if you have Redis available
# UPSTASH_REDIS_REST_URL=""
# UPSTASH_REDIS_REST_TOKEN=""

# ─── AI (optional) ──────────────────────────────
# OPENAI_API_KEY=""
# OPENAI_MODEL="gpt-4o-mini"

# ─── Email (optional) ──────────────────────────
# SMTP_HOST=""
# SMTP_PORT="587"
# SMTP_USER=""
# SMTP_PASS=""
# SMTP_FROM=""
`

  // Check if .env already exists
  if (existsSync(".env")) {
    const overwrite = await askYesNo(".env file already exists. Overwrite?", false)
    if (overwrite) {
      // Backup existing
      const backup = `.env.backup.${Date.now()}`
      const existing = readFileSync(".env", "utf-8")
      writeFileSync(backup, existing)
      info(`Existing .env backed up to ${backup}`)
      writeFileSync(".env", envContent)
      success(".env file updated")
    } else {
      info("Keeping existing .env file")
    }
  } else {
    writeFileSync(".env", envContent)
    success(".env file created")
  }

  log("")

  // ─── Step 5: Database Setup ─────────────────────────────────────
  log(`${c.bold}Step 5/5: Setting up database...${c.reset}`)

  // Install dependencies if needed
  if (!existsSync("node_modules")) {
    info("Installing dependencies...")
    try {
      execSync("bun install", { stdio: "inherit" })
      success("Dependencies installed")
    } catch {
      try {
        execSync("npm install", { stdio: "inherit" })
        success("Dependencies installed")
      } catch {
        error("Failed to install dependencies")
        process.exit(1)
      }
    }
  }

  // Generate Prisma client
  info("Generating Prisma client...")
  try {
    execSync("bunx prisma generate", { stdio: "inherit" })
    success("Prisma client generated")
  } catch {
    try {
      execSync("npx prisma generate", { stdio: "inherit" })
      success("Prisma client generated")
    } catch {
      error("Failed to generate Prisma client")
      process.exit(1)
    }
  }

  // Push database schema
  info("Pushing database schema...")
  try {
    execSync("bunx prisma db push", { stdio: "inherit" })
    success("Database schema applied")
  } catch {
    try {
      execSync("npx prisma db push", { stdio: "inherit" })
      success("Database schema applied")
    } catch {
      error("Failed to push database schema")
      process.exit(1)
    }
  }

  log("")

  // ─── Seed Admin User ────────────────────────────────────────────
  log(`${c.bold}Creating admin user...${c.reset}`)

  const adminName = await ask("Admin name", "Admin")
  const adminEmail = await ask("Admin email", "admin@localhost")
  const adminPassword = await ask("Admin password", "admin123")

  info("Creating admin user...")
  try {
    // Use inline script to create admin user via Prisma
    const seedScript = `
      const { PrismaClient } = require('./prisma/generated-client');
      const bcrypt = require('bcrypt');
      
      async function seedAdmin() {
        const db = new PrismaClient();
        try {
          const hashedPassword = await bcrypt.hash('${adminPassword}', 12);
          
          const user = await db.user.upsert({
            where: { email: '${adminEmail}' },
            update: {
              name: '${adminName}',
              password: hashedPassword,
              role: 'super_admin',
              plan: 'enterprise',
              emailVerified: new Date(),
            },
            create: {
              email: '${adminEmail}',
              name: '${adminName}',
              password: hashedPassword,
              role: 'super_admin',
              plan: 'enterprise',
              emailVerified: new Date(),
            },
          });
          
          console.log('Admin user created: ' + user.email);
        } finally {
          await db.$disconnect();
        }
      }
      
      seedAdmin().catch(console.error);
    `
    
    execSync(`bun -e "${seedScript.replace(/"/g, '\\"').replace(/\n/g, " ")}"`, { stdio: "inherit" })
    success(`Admin user created: ${adminEmail}`)
  } catch {
    // Fallback: try with a temporary file
    try {
      const tmpFile = path.join(process.cwd(), ".selfhost-seed-admin.js")
      writeFileSync(tmpFile, `
        const { PrismaClient } = require('./prisma/generated-client');
        const bcrypt = require('bcrypt');
        
        async function seedAdmin() {
          const db = new PrismaClient();
          try {
            const hashedPassword = await bcrypt.hash('${adminPassword}', 12);
            
            const user = await db.user.upsert({
              where: { email: '${adminEmail}' },
              update: {
                name: '${adminName}',
                password: hashedPassword,
                role: 'super_admin',
                plan: 'enterprise',
                emailVerified: new Date(),
              },
              create: {
                email: '${adminEmail}',
                name: '${adminName}',
                password: hashedPassword,
                role: 'super_admin',
                plan: 'enterprise',
                emailVerified: new Date(),
              },
            });
            
            console.log('Admin user created: ' + user.email);
          } finally {
            await db.$disconnect();
          }
        }
        
        seedAdmin().catch(console.error);
      `)
      execSync(`bun ${tmpFile}`, { stdio: "inherit" })
      // Clean up temp file
      try { execSync(`rm ${tmpFile}`, { stdio: "pipe" }) } catch { /* ignore */ }
      success(`Admin user created: ${adminEmail}`)
    } catch (e) {
      warn(`Could not auto-create admin user. You can register via the web UI instead.`)
    }
  }

  log("")

  // ─── Final Output ───────────────────────────────────────────────
  log(`${c.bold}${c.green}╔════════════════════════════════════════════════╗${c.reset}`)
  log(`${c.bold}${c.green}║                                                ║${c.reset}`)
  log(`${c.bold}${c.green}║     ✅ SaCMS Self-Hosted Setup Complete!       ║${c.reset}`)
  log(`${c.bold}${c.green}║                                                ║${c.reset}`)
  log(`${c.bold}${c.green}╚════════════════════════════════════════════════╝${c.reset}`)
  log("")
  log(`${c.bold}Next steps:${c.reset}`)
  log("")
  log(`  ${c.cyan}1.${c.reset} Build the application:`)
  log(`     ${c.dim}$ bun run build${c.reset}`)
  log("")
  log(`  ${c.cyan}2.${c.reset} Start the server:`)
  log(`     ${c.dim}$ bun run start${c.reset}`)
  log("")
  log(`  ${c.cyan}3.${c.reset} Open in your browser:`)
  log(`     ${c.bold}${appUrl}/dashboard${c.reset}`)
  log("")
  log(`  ${c.cyan}4.${c.reset} Login with:`)
  log(`     ${c.dim}Email:${c.reset}    ${adminEmail}`)
  log(`     ${c.dim}Password:${c.reset} ${adminPassword}`)
  log("")
  if (licenseKey) {
    log(`  ${c.green}🔑 Enterprise license will be activated on first login.${c.reset}`)
  } else {
    log(`  ${c.yellow}💡 No license key provided. You can activate one later at:${c.reset}`)
    log(`     ${c.dim}${appUrl}/dashboard/setup${c.reset}`)
  }
  log("")
  log(`${c.dim}For production deployment, see SELFHOST.md${c.reset}`)
  log("")

  rl.close()
}

main().catch((err) => {
  error(`Setup failed: ${err.message}`)
  rl.close()
  process.exit(1)
})
