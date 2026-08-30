"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function AdminPageSkeleton({ 
  headerTitle = "Memuat Halaman Admin...",
  cardsCount = 4,
  layout = "table" // "table" | "grid" | "dashboard" | "form"
}: { 
  headerTitle?: string
  cardsCount?: number
  layout?: "table" | "grid" | "dashboard" | "form"
}) {
  return (
    <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/70">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Strip */}
      {cardsCount > 0 && (
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cardsCount} gap-4`}>
          {Array.from({ length: cardsCount }).map((_, i) => (
            <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-xl" />
              </div>
              <Skeleton className="h-7 w-28 rounded-lg" />
              <Skeleton className="h-3 w-36 rounded-md" />
            </Card>
          ))}
        </div>
      )}

      {/* Layout variants */}
      {layout === "table" && (
        <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
          <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 rounded-md" />
              <Skeleton className="h-3 w-56 rounded-md" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-48 rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/50">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-4 px-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                  <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton className="h-4 w-48 max-w-full rounded-md" />
                    <Skeleton className="h-3 w-32 rounded-md" />
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-7 w-7 rounded-lg" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {layout === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, col) => (
            <Card key={col} className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
              <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
                <Skeleton className="h-4 w-44 rounded-md" />
                <Skeleton className="h-7 w-20 rounded-lg" />
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/50">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-4 px-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-36 rounded-md" />
                        <Skeleton className="h-3 w-24 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {layout === "form" && (
        <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-6 space-y-6">
          <div className="space-y-2 pb-4 border-b border-border/60">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3.5 w-80 rounded-md" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-28 rounded-md" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-border/60">
            <Skeleton className="h-9 w-24 rounded-xl" />
            <Skeleton className="h-9 w-32 rounded-xl" />
          </div>
        </Card>
      )}

      {layout === "grid" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-2/3 rounded-md" />
              <div className="pt-3 border-t border-border/60 flex justify-between items-center">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
