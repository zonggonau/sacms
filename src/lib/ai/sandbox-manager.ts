/**
 * AI Website Builder — Sandbox & Preview Manager
 *
 * Manages the preview environment for generated websites.
 * Supports:
 * 1. Sandpack (in-browser React/Next.js runner — zero-config, immediate, works offline/self-hosted)
 * 2. Vercel Sandbox / Hosted Preview (when configured with Vercel API credentials)
 */

export interface SandboxFile {
  name: string
  content: string
}

export interface SandboxSession {
  id: string
  type: "sandpack" | "vercel-sandbox" | "hosted"
  previewUrl?: string
  files: SandboxFile[]
  status: "initializing" | "ready" | "error" | "stopped"
  createdAt: string
  error?: string
}

export class SandboxManager {
  /**
   * Determine optimal sandbox provider based on environment and file contents.
   */
  static getPreferredProvider(): "sandpack" | "vercel-sandbox" {
    // If Vercel Sandbox token is present in env, can use microVM sandbox
    if (process.env.VERCEL_SANDBOX_TOKEN || process.env.VERCEL_OIDC_TOKEN) {
      return "vercel-sandbox"
    }
    // Default to Sandpack in-browser preview
    return "sandpack"
  }

  /**
   * Prepares and normalizes files for Sandpack execution.
   */
  static prepareSandpackFiles(files: SandboxFile[]): Record<string, string> {
    const out: Record<string, string> = {}

    for (const file of files) {
      const path = file.name.startsWith("/") ? file.name : `/${file.name}`
      out[path] = file.content
    }

    // Ensure App.tsx entrypoint exists for Sandpack
    const pageFile = files.find((f) => f.name === "app/page.tsx" || f.name.endsWith("/page.tsx"))
    if (pageFile && !out["/App.tsx"]) {
      out["/App.tsx"] = pageFile.content
    }

    return out
  }
}
