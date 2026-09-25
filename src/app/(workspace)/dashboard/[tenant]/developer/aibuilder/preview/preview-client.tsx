"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  ArrowLeft,
  Globe,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { SandpackPreview } from "@/components/ai-builder/sandpack-preview"

interface StandalonePreviewClientProps {
  tenantSlug: string
  tenantName: string
  siteName: string
  initialFiles: Array<{ name: string; content: string }>
  previewUrl: string | null
}

export function StandalonePreviewClient({
  tenantSlug,
  tenantName,
  siteName,
  initialFiles,
  previewUrl,
}: StandalonePreviewClientProps) {
  const router = useRouter()
  const [deviceMode, setDeviceMode] = useState<"desktop" | "tablet" | "mobile">("desktop")
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [files, setFiles] = useState<Array<{ name: string; content: string }>>(initialFiles)
  const [isLoaded, setIsLoaded] = useState(false)

  // Read latest live files from sessionStorage if available
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("sacms_preview_files")
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setFiles(parsed)
          }
        }
      }
    } catch {}
    setIsLoaded(true)
  }, [])

  const handleBackToStudio = () => {
    // If opened via window.open, attempt window.close() first
    if (window.opener && !window.opener.closed) {
      window.close()
    } else {
      router.push(`/dashboard/${tenantSlug}/developer/aibuilder`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-screen w-screen bg-background overflow-hidden select-none">
      {/* ── Top Header Toolbar ── */}
      <header className="h-12 px-4 border-b border-border/70 bg-card/90 backdrop-blur-md flex items-center justify-between shrink-0 gap-3">
        {/* Left: Back to Studio & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToStudio}
            className="gap-1.5 h-8 px-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
            title="Kembali ke Studio AI Website Builder"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Kembali ke Studio</span>
          </Button>

          <div className="h-4 w-px bg-border/80 hidden sm:block" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-xs text-foreground truncate max-w-[200px] sm:max-w-[320px]">
              {siteName || `${tenantName} Website`}
            </span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-2.5 w-2.5" />
              Live Preview Tab Baru
            </span>
          </div>
        </div>

        {/* Center: Device Mode Switcher */}
        <div className="flex items-center bg-muted/80 border border-border/60 rounded-lg p-0.5">
          <Button
            variant={deviceMode === "desktop" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("desktop")}
            className="h-7 w-7 rounded-md cursor-pointer"
            title="Desktop (100% Full Width)"
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceMode === "tablet" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("tablet")}
            className="h-7 w-7 rounded-md cursor-pointer"
            title="Tablet (768px)"
          >
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={deviceMode === "mobile" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setDeviceMode("mobile")}
            className="h-7 w-7 rounded-md cursor-pointer"
            title="Mobile (375px)"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Right: Refresh & Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Refresh Halaman"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>

          {previewUrl && previewUrl.startsWith("http") && !previewUrl.includes("localhost") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, "_blank")}
              className="gap-1.5 h-8 px-3 rounded-full text-xs font-semibold cursor-pointer hidden sm:inline-flex"
              title="Buka URL Deployment Asli"
            >
              <Globe className="h-3 w-3" />
              <span>Production URL</span>
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </Button>
          )}
        </div>
      </header>

      {/* ── Main Preview Canvas ── */}
      <main className="flex-1 min-h-0 w-full overflow-hidden bg-muted/20 p-2 md:p-4 flex items-center justify-center">
        <div
          className={`h-full bg-background rounded-xl overflow-hidden border border-border/80 shadow-md flex flex-col transition-all duration-300 ${
            deviceMode === "desktop"
              ? "w-full"
              : deviceMode === "tablet"
              ? "w-[768px] max-w-full"
              : "w-[375px] max-w-full"
          }`}
        >
          {isLoaded && files.length > 0 ? (
            <SandpackPreview key={refreshNonce} files={files} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground p-6 text-center">
              <Monitor className="h-10 w-10 stroke-[1.5] text-muted-foreground/60" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  Belum ada kode website yang dapat ditampilkan
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Silakan generate website terlebih dahulu di Studio AI Website Builder.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBackToStudio}
                className="mt-2 text-xs rounded-full gap-1.5"
              >
                <ArrowLeft className="h-3 w-3" />
                Buka AI Website Builder Studio
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
