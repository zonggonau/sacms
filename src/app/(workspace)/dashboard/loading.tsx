import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DashboardLoading() {
  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Top Header Feed */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Metrics Row Feed */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-7 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-10 w-10 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left 2 Columns Feed */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl">
            <CardHeader className="p-5 border-b border-border/60 flex flex-row items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40 rounded-lg" />
                <Skeleton className="h-3.5 w-60 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </CardHeader>
            <CardContent className="p-5 divide-y divide-border/50 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="pt-4 first:pt-0 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <Skeleton className="h-4 w-48 max-w-full rounded-md" />
                      <Skeleton className="h-3 w-32 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Column Feed */}
        <div className="space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-32 rounded-lg" />
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-20 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="h-3 w-12 rounded-md" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            </div>
          </Card>

          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-40 rounded-lg" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
