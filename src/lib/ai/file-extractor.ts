/**
 * SaCMS AI Website Builder — Resilient File Extractor
 *
 * Extracts generated files from:
 * 1. Native AI SDK Tool Invocations (writeFile, updateFile, createFile)
 * 2. Structured JSON payload ({ files: [...] })
 * 3. Markdown codeblocks with file path headers (e.g. ```tsx [app/page.tsx])
 *
 * Works in both Node/server and browser client environments.
 */

export interface ExtractedFile {
  name: string
  content: string
  description?: string
}

/**
 * Extract files from an AI message (handles text parts, tool-invocation parts, and JSON)
 */
export function extractFilesFromMessage(message: any): ExtractedFile[] {
  if (!message) return []
  const filesMap = new Map<string, ExtractedFile>()

  const processFileCandidate = (path: any, content: any, description?: any) => {
    if (typeof path === "string" && typeof content === "string" && path.trim() && content.trim()) {
      const cleanPath = normalizeFilePath(path)
      filesMap.set(cleanPath, {
        name: cleanPath,
        content,
        description: typeof description === "string" ? description : undefined,
      })
    }
  }

  // Handle both single message and array of messages
  const msgs = Array.isArray(message) ? message : [message]

  for (const msg of msgs) {
    if (!msg) continue

    // 1. Inspect parts (Vercel AI SDK 7 native tool parts and legacy invocations)
    if (Array.isArray(msg.parts)) {
      for (const part of msg.parts) {
        if (!part) continue

        // Determine tool name
        let toolName = ""
        if (typeof part.type === "string" && part.type.startsWith("tool-")) {
          toolName = part.type.slice(5) // e.g. "tool-writeFile" -> "writeFile"
        } else if (part.toolName) {
          toolName = part.toolName
        } else if (part.name) {
          toolName = part.name
        }

        const inv = part.toolInvocation || part
        const invToolName = inv.toolName || inv.name || toolName
        const targetTool = invToolName || toolName

        if (
          targetTool === "writeFile" ||
          targetTool === "write_file" ||
          targetTool === "createFile" ||
          targetTool === "updateFile"
        ) {
          const args =
            part.input ||
            part.args ||
            inv.args ||
            inv.input ||
            part.output?.input ||
            part.output
          const path = args?.path || args?.name || args?.filename
          const content = args?.content || args?.code
          processFileCandidate(path, content, args?.description)
        }
      }
    }

    // 2. Direct toolInvocations array on message
    if (Array.isArray(msg.toolInvocations)) {
      for (const inv of msg.toolInvocations) {
        if (!inv) continue
        const toolName = inv.toolName || inv.name
        if (toolName === "writeFile" || toolName === "write_file" || toolName === "createFile") {
          const args = inv.args || inv.input
          processFileCandidate(args?.path || args?.name, args?.content || args?.code, args?.description)
        }
      }
    }

    // 3. Direct toolCalls array on message
    if (Array.isArray(msg.toolCalls)) {
      for (const tc of msg.toolCalls) {
        if (!tc) continue
        const toolName = tc.toolName || tc.function?.name || tc.name
        if (toolName === "writeFile" || toolName === "write_file" || toolName === "createFile") {
          let args = tc.args || tc.input || tc.function?.arguments
          if (typeof args === "string") {
            try { args = JSON.parse(args) } catch {}
          }
          processFileCandidate(args?.path || args?.name, args?.content || args?.code, args?.description)
        }
      }
    }

    // 4. Inspect text content for embedded JSON or code blocks
    const rawText = extractRawTextFromMessage(msg)
    if (rawText) {
      const textFiles = extractFilesFromRawText(rawText)
      for (const f of textFiles) {
        if (!filesMap.has(f.name)) {
          filesMap.set(f.name, f)
        }
      }
    }
  }

  return Array.from(filesMap.values())
}

/**
 * Extract files from raw text (supports JSON format and markdown fences)
 */
export function extractFilesFromRawText(rawText: string): ExtractedFile[] {
  if (!rawText || typeof rawText !== "string") return []

  // Attempt 1: Extract from JSON structure
  const jsonFiles = tryParseJsonFiles(rawText)
  if (jsonFiles.length > 0) return jsonFiles

  // Attempt 2: Extract from fenced codeblocks with file comments
  const codeBlockFiles = tryParseCodeblockFiles(rawText)
  if (codeBlockFiles.length > 0) return codeBlockFiles

  return []
}

/**
 * Normalize file paths into standard app/..., components/..., lib/... conventions
 */
export function normalizeFilePath(path: string): string {
  let clean = path.replace(/^[\\/]+/, "").trim()
  if (clean.startsWith("src/")) {
    clean = clean.replace(/^src\//, "")
  }
  return clean
}

/**
 * Merge updated files into previous files (preserving unchanged files)
 */
export function mergeProjectFiles(
  previousFiles: Array<{ name: string; content: string }>,
  newFiles: Array<{ name: string; content: string }>,
  deletedPaths: string[] = []
): Array<{ name: string; content: string }> {
  const map = new Map<string, string>()

  // Seed with previous files
  for (const f of previousFiles) {
    map.set(normalizeFilePath(f.name), f.content)
  }

  // Remove deleted files
  for (const del of deletedPaths) {
    map.delete(normalizeFilePath(del))
  }

  // Apply new or updated files
  for (const f of newFiles) {
    map.set(normalizeFilePath(f.name), f.content)
  }

  return Array.from(map.entries()).map(([name, content]) => ({ name, content }))
}

// ────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ────────────────────────────────────────────────────────────────────────────

function extractRawTextFromMessage(m: any): string {
  if (!m) return ""
  if (typeof m.content === "string") return m.content
  if (Array.isArray(m.parts)) {
    return m.parts
      .filter((p: any) => p && (p.type === "text" || !p.type) && typeof p.text === "string")
      .map((p: any) => p.text)
      .join("")
  }
  return ""
}

function tryParseJsonFiles(text: string): ExtractedFile[] {
  let cleaned = text.trim()
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "")
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "")
  }

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1)
    try {
      const parsed = JSON.parse(candidate)
      const rawFiles = Array.isArray(parsed?.files)
        ? parsed.files
        : Array.isArray(parsed?.project?.files)
        ? parsed.project.files
        : []

      return rawFiles
        .filter((f: any) => f && typeof f.name === "string" && typeof f.content === "string")
        .map((f: any) => ({
          name: normalizeFilePath(f.name),
          content: f.content,
          description: f.description,
        }))
    } catch {
      // Incomplete or streaming JSON, fall through
    }
  }

  return []
}

function tryParseCodeblockFiles(text: string): ExtractedFile[] {
  const files: ExtractedFile[] = []
  // Matches ```(tsx|jsx|ts|js|css) (file="path" or // path or path)
  const regex = /```(?:[a-zA-Z0-9_-]+)?(?:\s+(?:file=|filepath=|path=)?["']?([a-zA-Z0-9_./\\-]+)["']?)?\n([\s\S]*?)```/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    let filePath = match[1]
    const content = match[2]

    // If filename wasn't in the fence tag, check the first line of content
    if (!filePath && content) {
      const firstLine = content.trim().split("\n")[0]
      const fileHeaderMatch = firstLine.match(/^(?:\/\/|\/\*|<!--|#)\s*([a-zA-Z0-9_./\\-]+\.(?:tsx|ts|jsx|js|css|json))/i)
      if (fileHeaderMatch) {
        filePath = fileHeaderMatch[1]
      }
    }

    if (filePath && content) {
      const cleanPath = normalizeFilePath(filePath)
      if (cleanPath.includes("/") || cleanPath.endsWith(".tsx") || cleanPath.endsWith(".ts")) {
        files.push({
          name: cleanPath,
          content: content.trim(),
        })
      }
    }
  }

  return files
}
