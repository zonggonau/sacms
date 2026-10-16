import "server-only"

import { createHash } from "node:crypto"
import { Sandbox } from "@vercel/sandbox"
import type { PrismaClient } from "../../../prisma/generated-client"
import { getVercelToken } from "@/lib/vercel-client"
import { listProjectFiles } from "./files"

/*
 * One persistent, named Vercel Sandbox per project. The tenant's dedicated
 * Prisma DB holds the source of truth (`AiSiteFile`), every sync rewrites the
 * app into the sandbox, so a sandbox that expired, was resumed from a
 * snapshot, or was never created can always be rebuilt. Persistent sandboxes
 * keep `node_modules` across sessions, but processes (the dev server) must be
 * restarted after a resume.
 */

const PORT = 3000
const SANDBOX_TIMEOUT_MS = 30 * 60 * 1000
const INSTALL_TIMEOUT_MS = 5 * 60 * 1000
const DEV_READY_TIMEOUT_MS = 90 * 1000
const STATE_DIR = ".sacms"
const OUTPUT_LIMIT = 8_000

export class SandboxConfigError extends Error {}

export function sandboxName(tenantId: string, projectId: string) {
  return `sacms-${createHash("sha256").update(`${tenantId}:${projectId}`).digest("hex").slice(0, 24)}`
}

async function credentials() {
  const token = await getVercelToken()
  const teamId = process.env.VERCEL_TEAM_ID
  const projectId = process.env.VERCEL_PROJECT_ID
  if (token && teamId && projectId) {
    return { token, teamId, projectId }
  }
  if (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL) return {}
  throw new SandboxConfigError(
    "Vercel Sandbox is not configured. Set VERCEL_ACCESS_TOKEN, VERCEL_TEAM_ID and VERCEL_PROJECT_ID.",
  )
}

async function getSandbox(tenantId: string, projectId: string) {
  return Sandbox.getOrCreate({
    name: sandboxName(tenantId, projectId),
    persistent: true,
    image: "vercel/sandbox/node:24",
    ports: [PORT],
    timeout: SANDBOX_TIMEOUT_MS,
    resources: { vcpus: 2 },
    ...(await credentials()),
  })
}

// Serializes setup per project within this server instance so concurrent
// requests (the preview pane and an agent command) don't race `npm install`.
const setupLocks = new Map<string, Promise<unknown>>()

function withProjectLock<T>(projectId: string, task: () => Promise<T>): Promise<T> {
  const previous = setupLocks.get(projectId) ?? Promise.resolve()
  const next = previous.catch(() => undefined).then(task)
  setupLocks.set(projectId, next)
  return next.finally(() => {
    if (setupLocks.get(projectId) === next) setupLocks.delete(projectId)
  })
}

/** Syncs the project's files and installs dependencies. Returns the ready sandbox. */
export function prepareSandbox(tenantDb: PrismaClient, tenantId: string, projectId: string) {
  return withProjectLock(projectId, async () => {
    const sandbox = await getSandbox(tenantId, projectId)
    await syncFiles(sandbox, tenantDb, projectId)
    await installDependencies(sandbox)
    return sandbox
  })
}

/** Makes sure the dev server is serving the latest files and returns its public URL. */
export async function ensurePreview(tenantDb: PrismaClient, tenantId: string, projectId: string) {
  const sandbox = await prepareSandbox(tenantDb, tenantId, projectId)
  const url = sandbox.domain(PORT)

  await withProjectLock(projectId, async () => {
    if (await isServing(url)) return
    await sandbox.runCommand({ cmd: "npm", args: ["run", "dev"], detached: true })
    await waitUntilServing(url)
  })
  await sandbox.extendTimeout(SANDBOX_TIMEOUT_MS).catch(() => undefined)

  return { url }
}

/** Runs a command in the app directory with the latest files; output is truncated. */
export async function runSandboxCommand(
  tenantDb: PrismaClient,
  tenantId: string,
  projectId: string,
  command: string,
  args: string[],
) {
  const sandbox = await prepareSandbox(tenantDb, tenantId, projectId)
  const result = await sandbox.runCommand(command, args, { timeoutMs: INSTALL_TIMEOUT_MS })
  return {
    exitCode: result.exitCode,
    output: truncateOutput(await result.output("both")),
  }
}

/** Stops and deletes the project's sandbox, if it exists. */
export async function deleteProjectSandbox(tenantId: string, projectId: string) {
  const sandbox = await Sandbox.get({ name: sandboxName(tenantId, projectId), ...(await credentials()) }).catch(
    () => null,
  )
  await sandbox?.delete().catch(() => undefined)
}

async function syncFiles(sandbox: Sandbox, tenantDb: PrismaClient, projectId: string) {
  const files = await listProjectFiles(tenantDb, projectId)
  const manifestPath = `${STATE_DIR}/manifest.json`
  const previous = await readText(sandbox, manifestPath)
  const current = files.map((file) => file.path)

  // Remove files deleted since the last sync.
  const stale = previous ? (JSON.parse(previous) as string[]).filter((p) => !current.includes(p)) : []
  if (stale.length > 0) await sandbox.runCommand("rm", ["-f", "--", ...stale])

  await sandbox.writeFiles([
    ...files.map((file) => ({ path: file.path, content: file.content })),
    { path: manifestPath, content: JSON.stringify(current) },
  ])
}

async function installDependencies(sandbox: Sandbox) {
  const packageJson = (await readText(sandbox, "package.json")) ?? ""
  const hash = createHash("sha256").update(packageJson).digest("hex")
  const hashPath = `${STATE_DIR}/deps-hash`
  if ((await readText(sandbox, hashPath)) === hash) return

  const install = await sandbox.runCommand("npm", ["install", "--no-audit", "--no-fund"], {
    timeoutMs: INSTALL_TIMEOUT_MS,
  })
  if (install.exitCode !== 0) {
    throw new Error(`npm install failed:\n${truncateOutput(await install.output("both"))}`)
  }
  await sandbox.writeFiles([{ path: hashPath, content: hash }])
}

async function readText(sandbox: Sandbox, path: string) {
  const result = await sandbox.runCommand("cat", [path])
  return result.exitCode === 0 ? await result.stdout() : null
}

/** The sandbox router answers 502–504 while nothing listens on the port. */
async function isServing(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  return response !== null && ![502, 503, 504].includes(response.status)
}

async function waitUntilServing(url: string) {
  const deadline = Date.now() + DEV_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isServing(url)) return
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  throw new Error("The preview server did not start in time.")
}

function truncateOutput(output: string) {
  return output.length > OUTPUT_LIMIT
    ? `…(truncated)\n${output.slice(output.length - OUTPUT_LIMIT)}`
    : output
}
