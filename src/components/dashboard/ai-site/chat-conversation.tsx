"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, type UIMessage } from "ai"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { Loader2, ArrowUp, Square, Cpu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAiSiteModels } from "@/hooks/use-ai-site-models"
import { AiCreditsBadge } from "./ai-credits-badge"
import { MessageParts } from "./message-parts"
import { cn } from "@/lib/utils"

export function ChatConversation({
  tenantSlug,
  chatId,
  initialMessages,
  initialModel,
  onGenerationFinished,
}: {
  tenantSlug: string
  chatId: string
  initialMessages: UIMessage[]
  initialModel: string
  onGenerationFinished: () => void
}) {
  const apiBase = `/api/tenant/${encodeURIComponent(tenantSlug)}/ai-site/chats/${encodeURIComponent(chatId)}`
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${apiBase}/messages`,
        // The server keeps the history; send only the newest message.
        prepareSendMessagesRequest: ({ messages, trigger }) => ({
          body: { trigger, message: messages.at(-1) },
        }),
      }),
    [apiBase],
  )

  const [creditsTick, setCreditsTick] = useState(0)
  const { messages, sendMessage, regenerate, status, stop, error, clearError } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      onGenerationFinished()
      setCreditsTick((value) => value + 1) // each turn spends credits — refresh the balance shown
    },
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

  // The model picked at chat creation; changeable here too — applies from
  // the chat's next turn onward (the backend reads it fresh on every POST).
  const { options: modelOptions } = useAiSiteModels(tenantSlug)
  const [model, setModel] = useState(initialModel || modelOptions[0].value)
  const [savingModel, setSavingModel] = useState(false)
  async function changeModel(next: string) {
    const previous = model
    setModel(next)
    setSavingModel(true)
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || "Gagal mengganti model")
      }
    } catch (err) {
      setModel(previous)
      toast.error(err instanceof Error ? err.message : "Gagal mengganti model")
    } finally {
      setSavingModel(false)
    }
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
      <div className="shrink-0 border-t border-border">
        <div className="flex items-end gap-2 p-3 pb-1.5">
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
        <div className="flex items-center gap-1.5 border-t border-border/50 px-3 pb-2 pt-1">
          <Cpu className="size-3 shrink-0 text-muted-foreground" />
          <Select value={model} onValueChange={changeModel} disabled={savingModel || isBusy}>
            <SelectTrigger className="h-6 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none hover:bg-muted/50 focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72 rounded-xl border-border bg-card">
              {modelOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="rounded-lg text-xs">
                  <span className="font-semibold">{opt.label}</span>
                  <span className="ml-1.5 text-muted-foreground">— {opt.provider}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto">
            <AiCreditsBadge refreshKey={creditsTick} />
          </div>
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
