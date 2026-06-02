"use client"

import { Database, Zap, Sparkles, Cloud, Lock } from "lucide-react"

const defaultLogos = [
  { name: "Next.js", iconSrc: "https://cdn.simpleicons.org/nextdotjs/currentColor", isSvg: true },
  { name: "Prisma", iconSrc: "https://cdn.simpleicons.org/prisma/currentColor", isSvg: true },
  { name: "PostgreSQL", iconSrc: "https://cdn.simpleicons.org/postgresql/currentColor", isSvg: true },
  { name: "GraphQL", iconSrc: "https://cdn.simpleicons.org/graphql/currentColor", isSvg: true },
  { name: "Cloudflare", iconSrc: "https://cdn.simpleicons.org/cloudflare/currentColor", isSvg: true },
  { name: "Upstash", iconSrc: "https://cdn.simpleicons.org/upstash/currentColor", isSvg: true },
  { name: "Midtrans", icon: Lock, isSvg: false }, // Fallback since simpleicons lacks midtrans
]

export function LogoMarquee() {
  return (
    <section className="border-y border-border bg-muted/10 overflow-hidden py-8">
      <div className="container px-6 max-w-6xl mx-auto mb-6 text-center">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Powered By Enterprise-Grade Infrastructure
        </p>
      </div>
      <div className="container px-6 max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-6 md:gap-x-16">
        {defaultLogos.map((logo, i) => (
          <div key={i} className="flex items-center gap-3 opacity-50 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-default">
            {logo.isSvg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo.iconSrc} alt={logo.name} className="w-7 h-7 dark:invert" />
            ) : (
              logo.icon && <logo.icon className="w-7 h-7 text-foreground" />
            )}
            <span className="text-xl font-black tracking-tight text-foreground">{logo.name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
