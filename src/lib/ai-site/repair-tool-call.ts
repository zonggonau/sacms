import { NoSuchToolError, type ToolSet } from "ai"

/** The subset of the AI SDK's internal tool-call shape this repair needs. */
type RepairableToolCall = { toolCallId: string; toolName: string; input: unknown }
type AnyToolCall = RepairableToolCall & Record<string, unknown>

/**
 * Some models (smaller/faster ones especially) occasionally hallucinate a
 * slightly garbled tool name — e.g. calling `WritefilesFiles` instead of
 * `writeFiles`. The AI SDK rejects any call whose name doesn't exactly match
 * a registered tool (`NoSuchToolError`), which otherwise kills the whole
 * turn. Fuzzy-match the hallucinated name against the real tool list and
 * rewrite the call in place; only `null` (give up, let the real error
 * surface) when nothing is a confident match.
 */
export async function repairAiSiteToolCall<T extends AnyToolCall>({
  toolCall,
  tools,
  error,
}: {
  toolCall: T
  tools: ToolSet
  error: unknown
}): Promise<T | null> {
  if (!NoSuchToolError.isInstance(error)) return null

  const available = Object.keys(tools)
  const target = normalize(toolCall.toolName)

  let best: { name: string; distance: number } | null = null
  for (const name of available) {
    const distance = levenshtein(target, normalize(name))
    if (!best || distance < best.distance) best = { name, distance }
  }

  if (!best) return null

  // Require the correction to be "close" relative to the longer of the two
  // names — guards against confidently rewriting a call into an unrelated
  // tool, while still catching e.g. "WritefilesFiles" -> "writeFiles".
  const threshold = Math.max(4, Math.ceil(Math.max(best.name.length, target.length) * 0.5))
  if (best.distance > threshold) return null

  return { ...toolCall, toolName: best.name }
}

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}
