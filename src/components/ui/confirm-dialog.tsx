"use client"

import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Themed replacement for `window.confirm()`.
 *
 * ~22 files gated destructive actions on the native confirm dialog, which
 * ignores dark mode and can't be styled. This wraps AlertDialog with a
 * controlled `open` state and an async `onConfirm` (spinner + auto-close).
 *
 *   const [open, setOpen] = useState(false)
 *   <ConfirmDialog
 *     open={open} onOpenChange={setOpen}
 *     title="Delete role?"
 *     description="This can't be undone."
 *     confirmLabel="Delete" variant="destructive"
 *     onConfirm={() => deleteRole(id)}
 *   />
 */
type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: React.ReactNode
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  onConfirm: () => void | Promise<void>
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false)

  async function handleConfirm(event: React.MouseEvent) {
    event.preventDefault()
    try {
      setPending(true)
      await onConfirm()
      onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={pending}
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" }),
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * Hook form for imperative call sites migrating off `if (!confirm(...)) return`.
 *
 *   const confirm = useConfirm()
 *   ...
 *   if (!(await confirm({ title: "Delete?", variant: "destructive" }))) return
 *
 * Render `<confirm.dialog />` once in the component tree.
 */
type ConfirmOptions = Omit<
  ConfirmDialogProps,
  "open" | "onOpenChange" | "onConfirm"
>

function useConfirm() {
  const [state, setState] = React.useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null)

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ ...options, resolve })
    })
  }, [])

  const dialog = React.useCallback(() => {
    if (!state) return null
    const { resolve, ...options } = state
    return (
      <ConfirmDialog
        {...options}
        open
        onOpenChange={(next) => {
          if (!next) {
            resolve(false)
            setState(null)
          }
        }}
        onConfirm={() => {
          resolve(true)
          setState(null)
        }}
      />
    )
  }, [state])

  return { confirm, dialog }
}

export { ConfirmDialog, useConfirm }
