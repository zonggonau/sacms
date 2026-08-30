import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function GlobalDashboardLoading() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-xl" />
          <Skeleton className="h-4 w-80 max-w-full rounded-lg" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
      </div>

      {/* Quick Stats Feed */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded-md" />
              <Skeleton className="h-7 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl" />
          </Card>
        ))}
      </div>

      {/* Workspace Cards Grid Feed */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-44 rounded-lg" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
                  <div className="space-y-1.5 min-w-0">
                    <Skeleton className="h-4 w-32 rounded-md" />
                    <Skeleton className="h-3 w-20 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                <div className="space-y-1">
                  <Skeleton className="h-2.5 w-14 rounded-md" />
                  <Skeleton className="h-4 w-10 rounded-md" />
                </div>
                <div className="space-y-1">
                  <Skeleton className="h-2.5 w-14 rounded-md" />
                  <Skeleton className="h-4 w-10 rounded-md" />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <Skeleton className="h-4 w-24 rounded-md" />
                <Skeleton className="h-8 w-20 rounded-xl" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
