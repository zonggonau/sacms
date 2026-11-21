"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

/**
 * Full-bleed image preview — built on Radix Dialog directly (not the
 * @/components/ui/dialog wrapper) because that wrapper's DialogContent
 * hardcodes its own bg-black/50 DialogOverlay with no className passthrough,
 * which can't reproduce this lightbox's bg-black/80 + backdrop-blur-sm look.
 * Content is nested inside Overlay (mirrors the original hand-rolled
 * backdrop+box markup) — Radix's own outside-click detection still works
 * correctly here: clicking the overlay area itself (not inside Content)
 * closes the dialog, same as the original onClick-to-close backdrop.
 */
export function ImageLightboxDialog({
  imageUrl,
  onOpenChange,
  alt = "Preview",
}: {
  imageUrl: string | null
  onOpenChange: (open: boolean) => void
  alt?: string
}) {
  return (
    <DialogPrimitive.Root open={!!imageUrl} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200">
          <DialogPrimitive.Content className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center outline-none">
            <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
            <DialogPrimitive.Close
              className="absolute -top-12 right-0 sm:-right-12 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all shadow-xl hover:scale-110"
              title="Tutup (ESC)"
            >
              <X className="h-6 w-6" />
              <span className="sr-only">Tutup</span>
            </DialogPrimitive.Close>
            {imageUrl && (
              <img
                src={imageUrl}
                alt={alt}
                className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
