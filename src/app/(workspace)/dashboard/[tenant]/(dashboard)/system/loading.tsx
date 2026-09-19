import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SystemLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-52 rounded-xl" />
          <Skeleton className="h-3.5 w-72 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>

      {/* Metric Cards Feed */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-2">
            <Skeleton className="h-3.5 w-24 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Activity Table Feed */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
        <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </CardHeader>
        <CardContent className="p-0 divide-y divide-border/50">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <Skeleton className="h-4 w-44 rounded-md" />
                  <Skeleton className="h-3 w-64 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-3.5 w-28 rounded-md shrink-0" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
