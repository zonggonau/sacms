import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function InfrastructureLoading() {
  return (
    <div className="flex flex-1 flex-col w-full animate-in fade-in duration-300 min-h-[calc(100vh-4rem)]">
      {/* Top Banner Header Skeleton */}
      <div className="border-b border-border/70 bg-card/40 backdrop-blur-xs px-4 md:px-6 lg:px-8 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-xl" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-4 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-72 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-7 w-36 rounded-full" />
        </div>
      </div>

      {/* Main Container: Sub-Sidebar Skeleton + Content Skeleton */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col md:flex-row">
        {/* Mobile Horizontal Bar */}
        <div className="md:hidden border-b border-border/70 p-2 flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-xl shrink-0" />
          ))}
        </div>

        {/* Sub-Sidebar Skeleton */}
        <aside className="hidden md:flex w-64 lg:w-72 flex-col shrink-0 border-r border-border/70 p-4 lg:p-6 space-y-6 bg-card/25">
          <div className="space-y-2">
            <Skeleton className="h-3 w-28 rounded-md mb-3" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border border-transparent">
                <Skeleton className="w-7 h-7 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-24 rounded-md" />
                  <Skeleton className="h-2.5 w-32 rounded-md" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-border/60">
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </aside>

        {/* Content Pane Skeleton */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8 space-y-6">
          <div className="flex items-center gap-3 pb-3 border-b border-border/60">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="h-3 w-56 rounded-md" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="rounded-2xl border border-border/80 shadow-xs">
                <CardContent className="p-5 flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-48 rounded-md" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
