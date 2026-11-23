import * as React from "react"
import { Check, Circle, Package, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type StatusType = "published" | "draft" | "archived" | "failed" | "pending"

interface StatusBadgeProps {
  type: StatusType
  label?: string
  size?: "sm" | "md"
  showBorder?: boolean
}

const statusConfig: Record<StatusType, {
  icon: React.ComponentType<{ className?: string }>
  bg: string
  text: string
  border: string
}> = {
  published: {
    icon: Check,
    bg: "bg-emerald-50 dark:bg-emerald-950/20",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  draft: {
    icon: Circle,
    bg: "bg-amber-50 dark:bg-amber-950/20",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
  },
  archived: {
    icon: Package,
    bg: "bg-gray-50 dark:bg-gray-950/20",
    text: "text-gray-600 dark:text-gray-400",
    border: "border-gray-200 dark:border-gray-800",
  },
  failed: {
    icon: X,
    bg: "bg-red-50 dark:bg-red-950/20",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800",
  },
  pending: {
    icon: Loader2,
    bg: "bg-blue-50 dark:bg-blue-950/20",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
  },
}

const labels: Record<StatusType, string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
  failed: "Failed",
  pending: "Pending",
}

export function StatusBadge({
  type,
  label,
  size = "md",
  showBorder = true
}: StatusBadgeProps) {
  const config = statusConfig[type]
  const Icon = config.icon
  const displayLabel = label || labels[type]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 font-500 whitespace-nowrap",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        config.bg,
        config.text,
        showBorder && "border",
        showBorder && config.border,
        "rounded"
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-4"} />
      <span>{displayLabel}</span>
    </div>
  )
}

export function StatusBorderIndicator({
  type,
  variant = "solid"
}: {
  type: StatusType
  variant?: "solid" | "dashed"
}) {
  const statusColors: Record<StatusType, string> = {
    published: "border-l-emerald-500",
    draft: "border-l-amber-500",
    archived: "border-l-gray-400",
    failed: "border-l-red-500",
    pending: "border-l-blue-500",
  }

  return (
    <div
      className={cn(
        "border-l-4",
        variant === "dashed" && "border-l-dashed",
        statusColors[type]
      )}
    />
  )
}
