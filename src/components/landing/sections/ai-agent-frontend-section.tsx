"use client"

import {
  Code2, Sparkles, Bot, Github, Workflow,
  Rocket, MousePointer2, Wind, Terminal, MessageSquare, Hand,
  Sprout, Braces, LayoutTemplate
} from "lucide-react"
import type { SectionIntroData } from "../types"

// Every AI IDE/agent SaCMS's MCP server is advertised as working with
// across the marketing site (see src/app/docs/page.tsx's metadata and
// src/app/docs/docs-client.tsx's PLATFORMS setup guides) — no raster brand
// logos are vendored in this repo, so each gets a themed lucide icon
// instead of a real logo image.
const AI_DEV_TOOLS = [
  { icon: Rocket, label: "Antigravity", color: "text-amber-500" },
  { icon: Github, label: "VS Code + Copilot", color: "text-foreground" },
  { icon: MousePointer2, label: "Cursor", color: "text-violet-500" },
  { icon: Wind, label: "Windsurf", color: "text-sky-500" },
  { icon: Sparkles, label: "Claude", color: "text-orange-500" },
  { icon: Terminal, label: "Cline", color: "text-emerald-500" },
  { icon: MessageSquare, label: "ChatGPT", color: "text-green-500" },
  { icon: Hand, label: "Manus", color: "text-rose-500" },
  { icon: Sprout, label: "Emergent", color: "text-lime-500" },
  { icon: Braces, label: "Qoder", color: "text-indigo-500" },
  { icon: LayoutTemplate, label: "v0.dev", color: "text-muted-foreground" },
  { icon: Workflow, label: "Model Context Protocol", color: "text-blue-500" },
  { icon: Bot, label: "AI Agent Apa Pun", color: "text-primary" },
] as const

/**
 * Frontend dev happens in your own AI IDE/agent via MCP — no in-dashboard
 * site builder (see src/lib/mcp — removed 2026-10-20). Previously an inline
 * sub-block inside HeroSection; pulled out into its own standalone section
 * (right after the Website Template gallery) so Hero itself stays compact
 * and this gets room to actually explain the pitch, not just list logos.
 * Runs as an infinite marquee (duplicated once for a seamless loop) since
 * there are more tools than comfortably fit a static row.
 */
export function AiAgentFrontendSection({ data = null }: { data?: SectionIntroData | null }) {
  return (
    <section className="py-16 sm:py-20 relative bg-background border-t border-border/50 overflow-hidden">
      <div className="container px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-5 relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-bold tracking-wide backdrop-blur-md shadow-xs">
          <Code2 className="h-3.5 w-3.5" />
          <span>{data?.badge || "Frontend Development"}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight">
          {data?.title || "Kembangkan Frontend dengan AI Agent & IDE Favorit Anda"}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed">
          {data?.description || "Tidak perlu drag-and-drop builder. Tulis kode Next.js/React langsung di AI IDE atau agent pilihan Anda, lalu deploy ke SaCMS Cloud Hosting dalam satu perintah lewat MCP."}
        </p>
      </div>

      <div className="relative w-full overflow-hidden mt-10">
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
        <div className="flex w-max gap-4 animate-marquee">
          {[...AI_DEV_TOOLS, ...AI_DEV_TOOLS].map((tool, i) => (
            <div
              key={`${tool.label}-${i}`}
              className="flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-card/40 border border-border/50 text-sm font-bold text-foreground backdrop-blur-sm shrink-0"
            >
              <tool.icon className={`w-6 h-6 shrink-0 ${tool.color}`} />
              <span className="whitespace-nowrap">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
