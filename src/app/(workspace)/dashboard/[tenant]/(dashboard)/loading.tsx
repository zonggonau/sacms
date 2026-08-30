import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function TenantDashboardLoading() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-4 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* AI Spotlight Hero Card Feed */}
      <div className="border border-border/80 bg-muted/20 rounded-2xl p-5 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-xl flex-1">
            <Skeleton className="h-5 w-48 rounded-full" />
            <Skeleton className="h-7 w-72 max-w-full rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-3/4 rounded-md" />
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Skeleton className="h-9 w-32 rounded-xl" />
            <Skeleton className="h-9 w-24 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Stat Metric Cards Feed */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-4 md:p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-2 w-28 rounded-md" />
          </Card>
        ))}
      </div>

      {/* Main Split Content Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Recent Content & Collections */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
            <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-36 rounded-md" />
                <Skeleton className="h-3.5 w-52 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </CardHeader>
            <CardContent className="p-5 divide-y divide-border/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <Skeleton className="h-4 w-44 max-w-full rounded-md" />
                      <Skeleton className="h-3 w-28 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quota & Quick Tools */}
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-28 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-28 rounded-md" />
            <div className="space-y-2.5">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
