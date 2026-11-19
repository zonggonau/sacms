"use client"

import { useEffect, useState, type MouseEvent, type ReactNode } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export function MobilePortalMenu({ portal, className, children }: {
  portal: string
  className?: string
  children: ReactNode
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isMobile) setOpen(false)
  }, [isMobile])

  function closeOnLink(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
    const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
    if (link && link.target !== "_blank") setOpen(false)
  }

  return (
    <Sheet open={isMobile && open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Buka menu ${portal}`}
          className={cn("h-10 w-10 shrink-0 rounded-xl md:hidden", className)}
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[min(20rem,100vw)] gap-0 overflow-hidden p-0">
        <SheetTitle className="shrink-0 border-b px-4 py-3 text-sm">{portal}</SheetTitle>
        <SheetDescription className="sr-only">Menu navigasi workspace.</SheetDescription>
        <div className="min-h-0 flex-1" onClickCapture={closeOnLink}>
          {children}
        </div>
      </SheetContent>
    </Sheet>
  )
}
