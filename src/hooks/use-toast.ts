"use client"

/**
 * Compatibility shim.
 *
 * Historically the app shipped two toast systems: this Radix-based `useToast`
 * hook (~76 call sites) and `sonner` (~8 call sites, imported directly). Only
 * the Radix `<Toaster />` was mounted, so every `sonner` toast silently did
 * nothing.
 *
 * We standardised on `sonner`. Rather than rewrite 76 call sites, this file
 * keeps the `useToast()` / `toast()` API but forwards to `sonner` under the
 * hood. The shape callers use is uniformly:
 *
 *   toast({ title, description?, variant?: "destructive" })
 *
 * New code should import `toast` from `sonner` directly.
 */

import * as React from "react"
import { toast as sonnerToast } from "sonner"

type Toast = {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: "default" | "destructive" | null
  duration?: number
  action?: React.ReactNode
  /** Legacy escape hatch from the Radix era; forwarded to sonner's toast class. */
  className?: string
}

function renderTitle(value: React.ReactNode): string | React.ReactNode {
  return value ?? ""
}

function toast({ title, description, variant, duration, action, className }: Toast) {
  const options = {
    description: description ?? undefined,
    duration,
    action: action as never,
    className: className || undefined,
  }

  const id =
    variant === "destructive"
      ? sonnerToast.error(renderTitle(title), options)
      : sonnerToast(renderTitle(title), options)

  return {
    id: String(id),
    dismiss: () => sonnerToast.dismiss(id),
    update: (next: Toast) => {
      sonnerToast(
        renderTitle(next.title ?? title),
        {
          id,
          description: next.description ?? description ?? undefined,
        },
      )
    },
  }
}

function useToast() {
  return {
    toast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
    toasts: [] as const,
  }
}

export { useToast, toast }
