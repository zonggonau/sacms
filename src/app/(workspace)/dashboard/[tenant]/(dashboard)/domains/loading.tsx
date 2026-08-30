import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DomainsLoading() {
  return (
    <div className="flex flex-1 flex-col w-full animate-in fade-in duration-300">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-7xl mx-auto space-y-8">
          
          {/* Header Feed */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <Skeleton className="w-8 h-8 rounded-xl" />
                <Skeleton className="h-8 w-56 rounded-xl" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-96 max-w-full rounded-md" />
            </div>

            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          </div>

          {/* DNS Gateway Setup Guidance Card Feed */}
          <Card className="rounded-2xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-xs overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4 rounded-md" />
                  <Skeleton className="h-5 w-72 rounded-md" />
                </div>
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-96 max-w-full rounded-md mt-2" />
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-background/80 border space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3.5 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
                <div className="p-4 rounded-xl bg-background/80 border space-y-2">
                  <Skeleton className="h-4 w-36 rounded-md" />
                  <Skeleton className="h-3.5 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-lg" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Domains Table Feed */}
          <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
            <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-44 rounded-md" />
                <Skeleton className="h-3.5 w-64 rounded-md" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </CardHeader>
            <CardContent className="p-5 space-y-4 divide-y divide-border/50">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-5 w-48 rounded-md" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-64 rounded-md" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-24 rounded-xl" />
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
