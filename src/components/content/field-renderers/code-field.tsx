"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Code2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface CodeFieldValue {
  code: string
  language: string
}

interface CodeFieldProps {
  value: CodeFieldValue | string | null | undefined
  onChange: (value: CodeFieldValue) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
}

const SUPPORTED_LANGUAGES = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "markdown", label: "Markdown" },
  { value: "yaml", label: "YAML" },
]

export function CodeField({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = "// Tulis kode di sini..."
}: CodeFieldProps) {
  const [copied, setCopied] = useState(false)

  const parsedValue: CodeFieldValue = typeof value === "object" && value !== null
    ? { code: value.code || "", language: value.language || "javascript" }
    : { code: typeof value === "string" ? value : "", language: "javascript" }

  const handleCodeChange = (code: string) => {
    onChange({ ...parsedValue, code })
  }

  const handleLanguageChange = (language: string) => {
    onChange({ ...parsedValue, language })
  }

  const handleCopy = () => {
    if (!parsedValue.code) return
    navigator.clipboard.writeText(parsedValue.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border/80 overflow-hidden bg-muted/20 shadow-xs">
      {/* Code Editor Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-muted/40 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <Select
            value={parsedValue.language}
            onValueChange={handleLanguageChange}
            disabled={disabled}
          >
            <SelectTrigger className="h-7 w-32 bg-background border-border/80 rounded-lg text-xs font-semibold">
              <SelectValue placeholder="Pilih Bahasa" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/80">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <SelectItem key={lang.value} value={lang.value} className="text-xs">
                  {lang.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded-lg"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
          {copied ? "Tersalin" : "Salin"}
        </Button>
      </div>

      {/* Code Area */}
      <div className="relative">
        <Textarea
          value={parsedValue.code}
          onChange={(e) => handleCodeChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          rows={7}
          className="font-mono text-xs border-0 bg-transparent rounded-none focus-visible:ring-0 resize-y p-3.5 leading-relaxed text-foreground"
        />
      </div>
    </div>
  )
}
