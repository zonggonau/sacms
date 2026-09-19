import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SubscriptionsLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-6xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-72 max-w-full rounded-md" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Current Active Plan Card Feed */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-border/60 pb-4">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-60 rounded-md" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-4 border border-border/60 rounded-xl space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="h-3 w-12 rounded-md" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </Card>

      {/* Plans Pricing Grid Feed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl p-6 space-y-5 flex flex-col justify-between">
            <div className="space-y-4">
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-8 w-36 rounded-lg" />
              <Skeleton className="h-3.5 w-full rounded-md" />
              <div className="space-y-2.5 pt-4 border-t border-border/60">
                <Skeleton className="h-3.5 w-3/4 rounded-md" />
                <Skeleton className="h-3.5 w-5/6 rounded-md" />
                <Skeleton className="h-3.5 w-2/3 rounded-md" />
              </div>
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
          </Card>
        ))}
      </div>
    </div>
  )
}
