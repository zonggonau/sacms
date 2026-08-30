import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function CMSDashboardLoading() {
  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-border/60">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-60 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Workflow Metric Status Cards Feed */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16 rounded-md" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
            <Skeleton className="h-6 w-10 rounded-md" />
          </Card>
        ))}
      </div>

      {/* Main Studio Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Entries Table Feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-60 rounded-md" />
              </div>
              <Skeleton className="h-8 w-28 rounded-lg" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <Skeleton className="h-4 w-52 max-w-full rounded-md" />
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-3 w-24 rounded-md" />
                          <Skeleton className="h-3 w-16 rounded-md" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-7 w-7 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Collections & Workflow Shortcuts */}
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-36 rounded-md" />
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="p-3 border border-border/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-lg" />
                    <Skeleton className="h-4 w-28 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-3">
            <Skeleton className="h-5 w-32 rounded-md" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-xl" />
          </Card>
        </div>
      </div>
    </div>
  )
}
