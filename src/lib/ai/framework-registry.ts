/**
 * SaCMS AI Website Builder — Framework Registry
 *
 * Next.js 16 (App Router) only. Other frameworks were removed: the agentic
 * generation loop is tuned specifically for the App Router file layout
 * (app/page.tsx, "use client" rules, next/link & next/image shims in the
 * Sandpack preview) and supporting five frameworks in parallel meant every
 * prompt/tool/preview fix had to account for shapes the product never
 * actually used.
 */

export type FrameworkId = "nextjs"

export interface FrameworkConfig {
  id: FrameworkId
  name: string
  shortName: string
  vercelSupport: "Native" | "Static" | "Serverless" | "Edge"
  mainEntryFile: string
  apiClientPath: string
  typesPath: string
  buildOutputDirectory: string
}

export const FRAMEWORK_REGISTRY: FrameworkConfig[] = [
  {
    id: "nextjs",
    name: "Next.js 16 (App Router)",
    shortName: "Next.js",
    vercelSupport: "Native",
    mainEntryFile: "app/page.tsx",
    apiClientPath: "lib/sacms.ts",
    typesPath: "types/cms.ts",
    buildOutputDirectory: ".next",
  },
]

/**
 * Get the (only) framework configuration. The id parameter is accepted for
 * call-site compatibility but ignored — always returns the Next.js config.
 */
export function getFrameworkConfig(_id?: string | null): FrameworkConfig {
  return FRAMEWORK_REGISTRY[0]
}
