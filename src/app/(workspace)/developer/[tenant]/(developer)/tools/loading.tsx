import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function DeveloperLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-52 rounded-xl" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Tabs Navigation Feed */}
      <div className="flex gap-2 border-b border-border/60 pb-2 overflow-x-auto">
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
      </div>

      {/* Developer Cards Grid Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-32 w-full rounded-xl" />
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4">
            <Skeleton className="h-5 w-32 rounded-md" />
            <div className="space-y-3">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
