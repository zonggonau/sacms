import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function MediaLibraryLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-44 rounded-xl" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Media Toolbar Feed */}
      <div className="border border-border/80 shadow-xs bg-card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Skeleton className="h-9 w-full sm:w-80 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
        </div>
      </div>

      {/* Media Grid Feed */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden group">
            <Skeleton className="h-36 w-full rounded-none" />
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-3.5 w-3/4 rounded-md" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-2.5 w-12 rounded-md" />
                <Skeleton className="h-2.5 w-16 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
