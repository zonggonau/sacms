import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function InfrastructureLoading() {
  return (
    <div className="flex flex-1 flex-col w-full animate-in fade-in duration-300">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8">
          
          {/* Header Feed */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <Skeleton className="h-8 w-64 rounded-xl" />
                <Skeleton className="h-5 w-32 rounded-full" />
              </div>
              <Skeleton className="h-4 w-96 max-w-full rounded-md" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-40 rounded-xl" />
            </div>
          </div>

          {/* Managed Appliance Banner Feed */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-5 w-72 rounded-md" />
                </div>
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-96 max-w-full rounded-md mt-2" />
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-2">
                    <Skeleton className="h-3 w-28 rounded-md" />
                    <Skeleton className="h-5 w-40 rounded-md" />
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <Skeleton className="h-4 w-3/4 rounded-md" />
                <Skeleton className="h-9 w-36 rounded-xl shrink-0" />
              </div>
            </CardContent>
          </Card>

          {/* BYODB Card Feed */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-5 w-64 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-80 max-w-full rounded-md mt-1" />
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-36 rounded-md" />
                <Skeleton className="h-9 w-full rounded-xl" />
                <Skeleton className="h-3 w-64 rounded-md" />
              </div>
            </CardContent>
          </Card>

          {/* BYOS Card Feed */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-md" />
                <Skeleton className="h-5 w-64 rounded-md" />
              </div>
              <Skeleton className="h-3.5 w-80 max-w-full rounded-md mt-1" />
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-28 rounded-md" />
                  <Skeleton className="h-9 w-full rounded-xl" />
                </div>
              </div>

              <div className="space-y-2">
                <Skeleton className="h-3.5 w-32 rounded-md" />
                <Skeleton className="h-9 w-full rounded-xl" />
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
