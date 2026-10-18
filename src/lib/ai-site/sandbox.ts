import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { Sandbox } from "@vercel/sandbox"
import type { PrismaClient } from "../../../prisma/generated-client"
import { getVercelToken, getVercelTeamId, getVercelProjectId } from "@/lib/vercel-client"
import { resolveFrontendEnv, renderDotEnv, resolveApiOrigin } from "@/lib/infrastructure/frontend-env"
import { getRedis } from "@/lib/redis"
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
// Confirmed live: even once the dev server is genuinely up ("Ready in
// 265ms"), Turbopack doesn't seem to reuse its compile cache between
// requests in this sandbox environment — every single request, not just
// the first, took ~9s. That's a deeper issue this timeout bump doesn't
// fix, just works around: 90s only fit ~7-8 of those before giving up,
// sometimes just short of whatever made isServing finally pass.
const DEV_READY_TIMEOUT_MS = 180 * 1000
const STATE_DIR = ".sacms"
const OUTPUT_LIMIT = 8_000
const DEV_LOG_PATH = `${STATE_DIR}/dev.log`

export class SandboxConfigError extends Error {}

export function sandboxName(tenantId: string, projectId: string) {
  return `sacms-${createHash("sha256").update(`${tenantId}:${projectId}`).digest("hex").slice(0, 24)}`
}

async function credentials() {
  const token = await getVercelToken()
  const teamId = await getVercelTeamId()
  const projectId = await getVercelProjectId()
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
    // Memory scales with vcpus (2048MB per vcpu) — 2 vcpus' 4GB genuinely
    // wasn't enough for Next.js 16's Turbopack dev server: confirmed live,
    // a real preview OOM'd ("JavaScript heap out of memory") after a
    // handful of requests, each taking ~9-10s (symptomatic of Turbopack
    // thrashing its compile cache under memory pressure rather than
    // reusing it) on a project with nothing unusual in its own code. 4
    // vcpus -> 8GB gives real headroom.
    resources: { vcpus: 4 },
    ...(await credentials()),
  })
}

// Serializes setup per project so concurrent requests (the preview pane and
// an agent command) don't race `npm install`. Redis-backed when configured
// (real cross-instance mutual exclusion — the actual correctness property
// that matters if the app ever runs more than one instance behind a load
// balancer), falling back to this in-memory per-process queue otherwise —
// same single-instance guarantee this always had.
const localLocks = new Map<string, Promise<unknown>>()
const LOCK_TTL_SECONDS = 600 // generous for a slow npm install; bounds how long a crashed holder can wedge the lock
const LOCK_POLL_MS = 500

async function withProjectLock<T>(projectId: string, task: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  if (!redis) {
    const previous = localLocks.get(projectId) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(task)
    localLocks.set(projectId, next)
    return next.finally(() => {
      if (localLocks.get(projectId) === next) localLocks.delete(projectId)
    })
  }

  // Redis path: spinlock, not a strict FIFO queue like the in-memory one —
  // mutual exclusion is what's actually required here, not call order.
  const lockKey = `ai-site-sandbox-lock:${projectId}`
  const token = randomUUID()
  const deadline = Date.now() + SANDBOX_TIMEOUT_MS
  while (!(await redis.set(lockKey, token, { nx: true, ex: LOCK_TTL_SECONDS }))) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for the sandbox setup lock on project ${projectId}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS))
  }

  try {
    return await task()
  } finally {
    // Release only if we still hold it — the TTL above is the real safety
    // net against a crashed holder, this is just tidy early release.
    const current = await redis.get(lockKey).catch(() => null)
    if (current === token) await redis.del(lockKey).catch(() => undefined)
  }
}

/** Syncs the project's files and installs dependencies. Returns the ready sandbox. */
export function prepareSandbox(tenantDb: PrismaClient, tenantId: string, tenantSlug: string, projectId: string) {
  return withProjectLock(projectId, async () => {
    const sandbox = await getSandbox(tenantId, projectId)
    await syncFiles(sandbox, tenantDb, projectId)
    await writeFrontendEnv(sandbox, tenantId, tenantSlug)
    await installDependencies(sandbox)
    return sandbox
  })
}

/** Makes sure the dev server is serving the latest files and returns its public URL. */
export async function ensurePreview(tenantDb: PrismaClient, tenantId: string, tenantSlug: string, projectId: string) {
  const sandbox = await prepareSandbox(tenantDb, tenantId, tenantSlug, projectId)
  const url = sandbox.domain(PORT)

  await withProjectLock(projectId, async () => {
    if (await isServing(url)) return
    // Detached, so its own stdout/stderr is never captured anywhere — a
    // crash (compile error, missing dependency, whatever) otherwise only
    // ever surfaces as an opaque "did not start in time" with zero clue
    // why. Redirect to a log file (via a shell, since runCommand's
    // cmd/args form execs the binary directly, no redirection support) so
    // a timeout can read back what actually happened.
    //
    // NODE_OPTIONS=--max-old-space-size is required here, confirmed live: a
    // real preview OOM'd with the heap capped at ~4.17GB — V8's own 64-bit
    // default old-space ceiling — even though vcpus:4 gives this sandbox
    // 8GB total. Raising vcpus alone doesn't raise V8's heap limit; nothing
    // tells it to use more than its hardcoded default unless this flag is
    // set. 6144MB (3/4 of the sandbox's 8192MB) leaves headroom for the OS
    // and any sibling node processes next dev spawns.
    await sandbox.runCommand({
      cmd: "sh",
      args: ["-c", `NODE_OPTIONS=--max-old-space-size=6144 npm run dev > ${DEV_LOG_PATH} 2>&1`],
      detached: true,
    })
    await waitUntilServing(sandbox, url)
  })
  await sandbox.extendTimeout(SANDBOX_TIMEOUT_MS).catch(() => undefined)

  return { url }
}

/** Runs a command in the app directory with the latest files; output is truncated. */
export async function runSandboxCommand(
  tenantDb: PrismaClient,
  tenantId: string,
  tenantSlug: string,
  projectId: string,
  command: string,
  args: string[],
) {
  const sandbox = await prepareSandbox(tenantDb, tenantId, tenantSlug, projectId)
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

/**
 * Writes `.env.local` straight into the sandbox filesystem — never through
 * `writeProjectFiles`/`AiSiteFile`, so the real API key is never stored as
 * project source, never visible in the Code tab, and never writable by the
 * model via `writeFiles` (`normalizeProjectPath` also blocks `.env*` for
 * that same reason). Gives every generated site a real, working connection
 * to this tenant's own CMS data via `@sacms/sdk` from the first preview —
 * same NEXT_PUBLIC_SACMS_API_URL / NEXT_PUBLIC_SACMS_TENANT / SACMS_API_KEY
 * convention `deploy_to_sacms` and the dashboard's own deploy path use
 * (`src/lib/infrastructure/frontend-env.ts`), so a site built here behaves
 * identically once actually deployed.
 */
async function writeFrontendEnv(sandbox: Sandbox, tenantId: string, tenantSlug: string) {
  const env = await resolveFrontendEnv(tenantId, tenantSlug, resolveApiOrigin())
  await sandbox.writeFiles([{ path: ".env.local", content: renderDotEnv(env) }])
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

async function waitUntilServing(sandbox: Sandbox, url: string) {
  const deadline = Date.now() + DEV_READY_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await isServing(url)) return
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  // Best-effort diagnostics — the sandbox itself may already be gone by
  // now (e.g. its own timeout elapsed, or it was deleted/recreated
  // concurrently), in which case reading the log throws its own unrelated
  // error. Never let that replace the real "did not start in time" —
  // that's the one thing we know for certain actually happened.
  const log = await readText(sandbox, DEV_LOG_PATH).catch(() => null)
  throw new Error(`The preview server did not start in time.\n\n${truncateOutput(log || "(no output captured)")}`)
}

function truncateOutput(output: string) {
  return output.length > OUTPUT_LIMIT
    ? `…(truncated)\n${output.slice(output.length - OUTPUT_LIMIT)}`
    : output
}
