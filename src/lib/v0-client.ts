import { v0 } from "v0"

export interface V0File {
  name: string
  content: string
}

export async function createV0Chat(
  prompt: string,
  modelName: string = "v0-pro"
): Promise<{ chatId: string; files: V0File[]; previewUrl: string }> {
  const modelProfiles: Record<string, string> = {
    "v0-mini": "AI Engine Profile: SaCMS AI Mini (Fast & Lightweight). Target: Single-page compact Next.js App Router layout with fast rendering and essential interactive components.",
    "v0-pro": "AI Engine Profile: SaCMS AI Pro (Production Standard). Target: Full-scale Next.js 16 App Router application with dynamic data querying, responsive UI, and rich states.",
    "v0-max": "AI Engine Profile: SaCMS AI Max (Deep Reasoning & High Complexity). Target: Advanced multi-view Next.js architecture with rich relational data models, modal flows, and deep filtering.",
    "v0-max-fast": "AI Engine Profile: SaCMS AI Max Fast (High Performance Ultra Fast). Target: High-throughput Next.js architecture with instant rendering pipelines and polished UI.",
  }

  const modelInstruction = modelProfiles[modelName] || modelProfiles["v0-pro"]
  const finalPrompt = `${modelInstruction}\n\n${prompt}`

  const chat = await v0.chats.create({ message: finalPrompt })

  const chatId =
    (chat as any)?.data?.chat?.id ||
    (chat as any)?.data?.id ||
    (chat as any)?.chat?.id ||
    (chat as any)?.id ||
    ""

  let files: V0File[] = []
  if (chatId) {
    try {
      const filesRes = await v0.chats.getFiles({ chatId })
      const rawFiles = (filesRes as any)?.data?.files || (filesRes as any)?.files || (filesRes as any)?.data || []
      if (Array.isArray(rawFiles)) {
        files = rawFiles.map((f: any) => ({
          name: f.path ?? f.name ?? "app/page.tsx",
          content: f.content ?? "",
        }))
      }
    } catch (fErr) {
      console.warn("Could not fetch v0 files:", fErr)
    }
  }

  let previewUrl = ""
  if (chatId) {
    previewUrl = await getV0Preview(chatId)
  }

  return {
    chatId,
    files,
    previewUrl,
  }
}

export async function generateV0Json(prompt: string): Promise<string> {
  const chat = await v0.chats.create({ message: prompt })
  
  // Extract text from chat.data.parts
  const parts = (chat as any)?.data?.parts || []
  const textPart = parts.find((p: any) => p.type === "text")
  const content = textPart ? textPart.text : ((chat as any)?.content || "")
  return content
}

export async function getV0Preview(chatId: string): Promise<string> {
  try {
    const preview = await v0.chats.getPreview({ chatId })
    const url = (preview as any)?.data?.url ?? (preview as any)?.url ?? ""
    if (url) return url
    return `https://v0.dev/chat/${chatId}`
  } catch {
    return `https://v0.dev/chat/${chatId}`
  }
}

export async function iterateV0Chat(
  chatId: string,
  message: string
): Promise<{ files: V0File[] }> {
  await v0.messages.send({ chatId, message })
  let files: V0File[] = []
  try {
    const filesRes = await v0.chats.getFiles({ chatId })
    const rawFiles = (filesRes as any)?.data?.files || (filesRes as any)?.files || (filesRes as any)?.data || []
    if (Array.isArray(rawFiles)) {
      files = rawFiles.map((f: any) => ({
        name: f.path ?? f.name ?? "app/page.tsx",
        content: f.content ?? "",
      }))
    }
  } catch (fErr) {
    console.warn("Could not fetch v0 files on iterate:", fErr)
  }
  return { files }
}

export async function deleteV0Chat(chatId: string): Promise<boolean> {
  try {
    if (typeof (v0.chats as any).delete === "function") {
      await (v0.chats as any).delete({ chatId })
      return true
    }
    return false
  } catch (error) {
    console.error("Failed to delete v0 chat:", error)
    return false
  }
}

export async function getV0ChatMessages(chatId: string): Promise<any[]> {
  try {
    const res = await v0.messages.list({ chatId, limit: 50 })
    return (res as any)?.data?.messages || (res as any)?.messages || (res as any)?.data || []
  } catch (error) {
    console.error("Failed to get v0 messages:", error)
    return []
  }
}
