import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Canonical page title block.
 *
 * Before this component the H1 appeared with 35+ different class strings
 * across pages (font-bold / font-black / font-extrabold, text-xl…text-3xl,
 * some uppercase, some hardcoding text-zinc-*). This fixes the spec:
 *
 *   title       text-2xl lg:text-3xl font-black tracking-tight text-foreground
 *   description text-sm text-muted-foreground mt-1
 *   action      right-aligned, wraps below on mobile
 *
 * `badge` renders inline next to the title (e.g. a status pill).
 */
type PageHeaderProps = {
  title: React.ReactNode
  description?: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

function PageHeader({
  title,
  description,
  badge,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black tracking-tight text-foreground lg:text-3xl">
            {title}
          </h1>
          {badge}
        </div>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}

export { PageHeader }
