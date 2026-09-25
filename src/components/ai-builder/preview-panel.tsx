"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Monitor, Tablet, Smartphone, ExternalLink, RefreshCw, ChevronDown,
} from "lucide-react"
import { SandpackPreview } from "./sandpack-preview"

interface PreviewPanelProps {
  previewUrl: string
  generatedFiles: Array<{ name: string; content: string }>
  /** Whether this is a local Sandpack preview (AI SDK builds) or a remote iframe */
  isSandpackPreview: boolean
  tenantSlug?: string
  onOpenNewTab?: () => void
}

/**
 * Right-side preview panel for the AI Builder studio.
 * Shows either a Sandpack in-browser preview or an iframe pointing
 * to a hosted preview URL. Includes device mode switcher and
 * refresh/open-in-new-tab actions.
 */
export function PreviewPanel({
  previewUrl,
  generatedFiles,
  isSandpackPreview,
  tenantSlug,
  onOpenNewTab,
}: PreviewPanelProps) {
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [previewRefreshNonce, setPreviewRefreshNonce] = useState(0)

  const handleOpenInNewTab = () => {
    if (onOpenNewTab) {
      onOpenNewTab()
      return
    }
    try {
      if (typeof window !== "undefined" && generatedFiles?.length > 0) {
        sessionStorage.setItem("sacms_preview_files", JSON.stringify(generatedFiles))
      }
    } catch {}

    if (
      previewUrl &&
      previewUrl.startsWith("http") &&
      !previewUrl.includes("localhost") &&
      !previewUrl.includes("previewTidakTersedia")
    ) {
      window.open(previewUrl, "_blank")
    } else if (tenantSlug) {
      window.open(`/dashboard/${tenantSlug}/developer/aibuilder/preview`, "_blank")
    } else if (previewUrl) {
      window.open(previewUrl, "_blank")
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-muted/20 min-h-0">

      {/* Sub-toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-card shrink-0">
        <span className="hidden md:flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
          Latest <ChevronDown className="h-3 w-3" />
        </span>

        {/* Device Mode Switcher */}
        <div className="flex items-center bg-muted rounded-md p-0.5 shrink-0">
          <Button
            variant={deviceMode === "desktop" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("desktop")}
            className="h-6 w-6 rounded cursor-pointer"
            title="Desktop (100%)"
          >
            <Monitor className="h-3 w-3" />
          </Button>
          <Button
            variant={deviceMode === "tablet" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("tablet")}
            className="h-6 w-6 rounded cursor-pointer"
            title="Tablet (768px)"
          >
            <Tablet className="h-3 w-3" />
          </Button>
          <Button
            variant={deviceMode === "mobile" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("mobile")}
            className="h-6 w-6 rounded cursor-pointer"
            title="Mobile (375px)"
          >
            <Smartphone className="h-3 w-3" />
          </Button>
        </div>

        {/* Address Bar */}
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-full px-3 py-1.5 text-[11px] font-mono text-muted-foreground min-w-0">
          <ChevronDown className="h-3 w-3 rotate-90 shrink-0 opacity-50" />
          <ChevronDown className="h-3 w-3 -rotate-90 shrink-0 opacity-50" />
          <span className="truncate flex-1">
            {isSandpackPreview
              ? "Sandpack — pratinjau lokal (Next.js 16)"
              : previewUrl || "https://sandbox.sacms.cloud"}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenInNewTab}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Buka di tab baru (Full Screen)"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPreviewRefreshNonce((n) => n + 1)}
            className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Frame Container */}
      <div className="flex-1 p-2 md:p-3 flex items-center justify-center overflow-hidden min-h-0 w-full">
        <div className={`h-full rounded-xl overflow-hidden border border-border/80 shadow-xs bg-background flex flex-col transition-all duration-300 ${
          deviceMode === "desktop" ? "w-full" : deviceMode === "tablet" ? "w-[768px] max-w-full" : "w-[375px] max-w-full"
        }`}>
          {isSandpackPreview && generatedFiles.length > 0 ? (
            <SandpackPreview key={previewRefreshNonce} files={generatedFiles} />
          ) : previewUrl ? (
            <iframe
              key={previewRefreshNonce}
              src={previewUrl}
              className="w-full h-full border-0 bg-background"
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground bg-muted/20">
              <Monitor className="h-6 w-6 text-muted-foreground" />
              <p className="text-xs">Preview website sedang disiapkan...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
