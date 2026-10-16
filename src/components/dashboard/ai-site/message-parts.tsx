"use client"

import { getToolName, isToolUIPart, type UIMessage } from "ai"
import { useState, type ReactNode } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  ChevronDown,
  XCircle,
  FileText,
  Search,
  Sparkles,
  Loader2,
  TerminalSquare,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

type Part = UIMessage["parts"][number]
type ToolPart = Extract<Part, { toolCallId: string }>

const BUILDER_TOOLS = new Set(["listFiles", "readFile", "writeFiles", "deleteFiles", "runCommand"])

export function MessageParts({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  if (message.role === "user") {
    return (
      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("\n")}
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {message.parts.map((part, index) => {
        const key = `${message.id}-${index}`
        if (part.type === "text") {
          return part.text.trim() ? (
            <div key={key} className="prose prose-sm dark:prose-invert max-w-none [&_p]:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
            </div>
          ) : null
        }
        if (part.type === "reasoning") {
          return part.text.trim() ? <Reasoning key={key} text={part.text} /> : null
        }
        if (isToolUIPart(part)) return <ToolActivity key={key} part={part as ToolPart} />
        return null
      })}
      {isStreaming && message.parts.length === 0 ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : null}
    </div>
  )
}

function Reasoning({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-xs text-muted-foreground">
      <button
        className="flex items-center gap-1 hover:text-foreground"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Sparkles className="size-3.5" /> Berpikir
        <ChevronDown className={cn("size-3 transition-transform", !open && "-rotate-90")} />
      </button>
      {open ? <p className="mt-1 border-l border-border pl-2 whitespace-pre-wrap">{text}</p> : null}
    </div>
  )
}

function ToolActivity({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const name = getToolName(part)
  const input = (part.input ?? {}) as Record<string, unknown>
  const output = part.state === "output-available" ? (part.output as Record<string, unknown>) : null
  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error" || (output !== null && typeof output.error === "string")
  const { icon, label, detail } = describe(name, input, output)

  return (
    <div className="rounded-lg border border-border bg-muted/30 text-xs">
      <button
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-muted-foreground hover:text-foreground"
        disabled={!detail && !failed}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {running ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin" />
        ) : failed ? (
          <XCircle className="size-3.5 shrink-0 text-destructive" />
        ) : (
          icon
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {detail || failed ? (
          <ChevronDown className={cn("size-3 shrink-0 transition-transform", !open && "-rotate-90")} />
        ) : null}
      </button>
      {open ? (
        <div className="border-t border-border px-2.5 py-2">
          {failed ? (
            <p className="mb-1 text-destructive">
              {part.state === "output-error" ? part.errorText : String(output?.error)}
            </p>
          ) : null}
          {detail}
        </div>
      ) : null}
    </div>
  )
}

function describe(
  name: string,
  input: Record<string, unknown>,
  output: Record<string, unknown> | null,
): { icon: ReactNode; label: string; detail?: ReactNode } {
  const fileIcon = <FileText className="size-3.5 shrink-0" />

  switch (name) {
    case "listFiles":
      return { icon: <Search className="size-3.5 shrink-0" />, label: "Listed files" }
    case "readFile":
      return { icon: fileIcon, label: `Read ${String(input.path ?? "a file")}` }
    case "writeFiles": {
      const files = Array.isArray(input.files) ? (input.files as { path?: string }[]) : []
      return {
        icon: fileIcon,
        label: `Wrote ${files.length} file${files.length === 1 ? "" : "s"}`,
        detail: <PathList paths={files.map((file) => file.path ?? "")} />,
      }
    }
    case "deleteFiles": {
      const paths = Array.isArray(input.paths) ? (input.paths as string[]) : []
      return { icon: fileIcon, label: `Deleted ${paths.length} file${paths.length === 1 ? "" : "s"}`, detail: <PathList paths={paths} /> }
    }
    case "runCommand": {
      const command = [input.command, ...(Array.isArray(input.args) ? input.args : [])].join(" ")
      const exit = typeof output?.exitCode === "number" ? ` (exit ${output.exitCode})` : ""
      return {
        icon: <TerminalSquare className="size-3.5 shrink-0" />,
        label: `Ran ${command}${exit}`,
        detail:
          typeof output?.output === "string" && output.output ? (
            <pre className="max-h-64 overflow-auto font-mono text-[11px] whitespace-pre-wrap">{output.output}</pre>
          ) : undefined,
      }
    }
    default:
      if (name.startsWith("cms_")) {
        return { icon: <Search className="size-3.5 shrink-0" />, label: `Baca data CMS (${name})` }
      }
      return {
        icon: <Wrench className="size-3.5 shrink-0" />,
        label: BUILDER_TOOLS.has(name) ? name : `Used ${name}`,
        detail:
          Object.keys(input).length > 0 ? (
            <pre className="max-h-48 overflow-auto font-mono text-[11px] whitespace-pre-wrap">
              {JSON.stringify(input, null, 2)}
            </pre>
          ) : undefined,
      }
  }
}

function PathList({ paths }: { paths: string[] }) {
  return (
    <ul className="flex flex-col gap-0.5 font-mono text-[11px] text-muted-foreground">
      {paths.map((path) => (
        <li key={path}>{path}</li>
      ))}
    </ul>
  )
}
