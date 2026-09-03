import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Standard page shell for dashboard / admin / CMS routes.
 *
 * Replaces the hand-copied
 *   `p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6`
 * wrapper that ~40 pages each re-declared (and drifted from).
 *
 * Use `width="6xl"` for narrow report pages, `flush` when the page
 * provides its own sticky sub-header and wants no top padding.
 */
type PageContainerProps = React.ComponentProps<"div"> & {
  width?: "7xl" | "6xl" | "5xl" | "full"
  flush?: boolean
}

const WIDTHS: Record<NonNullable<PageContainerProps["width"]>, string> = {
  "7xl": "max-w-7xl",
  "6xl": "max-w-6xl",
  "5xl": "max-w-5xl",
  full: "max-w-none",
}

function PageContainer({
  className,
  width = "7xl",
  flush = false,
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "w-full mx-auto space-y-6",
        flush ? "px-4 md:px-6 lg:px-8" : "p-4 md:p-6 lg:p-8",
        WIDTHS[width],
        className,
      )}
      {...props}
    />
  )
}

export { PageContainer }
