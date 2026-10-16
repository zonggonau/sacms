"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, ArrowUp, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageParts } from "./message-parts"
import { cn } from "@/lib/utils"

export function ChatConversation({
  tenantSlug,
  chatId,
  initialMessages,
  onGenerationFinished,
}: {
  tenantSlug: string
  chatId: string
  initialMessages: UIMessage[]
  onGenerationFinished: () => void
}) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/chats/${encodeURIComponent(chatId)}/messages`,
        // The server keeps the history; send only the newest message.
        prepareSendMessagesRequest: ({ messages, trigger }) => ({
          body: { trigger, message: messages.at(-1) },
        }),
      }),
    [tenantSlug, chatId],
  )

  const { messages, sendMessage, regenerate, status, stop, error, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: onGenerationFinished,
  })
  const isBusy = status === "submitted" || status === "streaming"

  // A chat created from the project page arrives with an unanswered first message.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || initialMessages.at(-1)?.role !== "user") return
    autoStarted.current = true
    void regenerate()
  }, [initialMessages, regenerate])

  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [messages, status])

  const streamingId = isBusy ? messages.findLast((message) => message.role === "assistant")?.id : null

  const [draft, setDraft] = useState("")
  const submit = () => {
    const text = draft.trim()
    if (!text || isBusy) return
    clearError()
    setDraft("")
    void sendMessage({ text })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <div className="flex w-full flex-col gap-4 px-3 py-4 text-[13px] leading-relaxed">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("group flex w-full", message.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  message.role === "user"
                    ? "w-fit max-w-[85%] rounded-2xl border border-border bg-muted px-3 py-1.5 [overflow-wrap:anywhere]"
                    : "w-full text-[13px] leading-relaxed",
                )}
              >
                <MessageParts isStreaming={message.id === streamingId} message={message} />
              </div>
            </div>
          ))}
          {status === "submitted" ? (
            <div role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Memikirkan…
            </div>
          ) : null}
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {errorText(error)}{" "}
              <button
                className="underline underline-offset-2"
                onClick={() => {
                  clearError()
                  void regenerate()
                }}
                type="button"
              >
                Coba lagi
              </button>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>
      </div>
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Minta perubahan pada situsmu…"
            className="min-h-9 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
            rows={2}
          />
          {isBusy ? (
            <Button size="icon" variant="outline" onClick={() => stop()} aria-label="Berhenti">
              <Square className="size-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={submit} disabled={!draft.trim()} aria-label="Kirim">
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The route answers errors as JSON `{ error }`, show that instead of the raw body. */
function errorText(error: Error) {
  try {
    const parsed = JSON.parse(error.message) as { error?: string; message?: string }
    if (parsed.error || parsed.message) return parsed.error || parsed.message
  } catch {
    // Not JSON: a stream error message.
  }
  return error.message || "Terjadi kesalahan."
}
