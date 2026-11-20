"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, ArrowUp } from "lucide-react"
import { TemplateGallery } from "@/components/landing/template-gallery"
import type { WebsiteTemplateItem } from "@/components/landing/types"

const PAGE_SIZE = 21 // 3 columns x 7 rows

export function TemplatesInfinite({
  initialTemplates,
  initialHasMore,
}: {
  initialTemplates: WebsiteTemplateItem[]
  initialHasMore: boolean
}) {
  const [templates, setTemplates] = useState(initialTemplates)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loading, setLoading] = useState(false)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(`/api/public/templates?offset=${templates.length}&limit=${PAGE_SIZE}`)
      if (res.ok) {
        const data = await res.json()
        setTemplates((prev) => [...prev, ...(data.templates || [])])
        setHasMore(!!data.hasMore)
      } else {
        setHasMore(false)
      }
    } catch {
      setHasMore(false)
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [templates.length, hasMore])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: "400px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 800)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <>
      <TemplateGallery templates={templates} />

      <div ref={sentinelRef} className="h-px" />

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs font-semibold">Memuat template lainnya...</span>
        </div>
      )}

      {!hasMore && templates.length > PAGE_SIZE && (
        <p className="text-center text-xs text-muted-foreground font-medium py-10">
          Anda telah melihat semua template.
        </p>
      )}

      {showBackToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Kembali ke atas"
          className="fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center hover:scale-110 transition-transform"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  )
}
