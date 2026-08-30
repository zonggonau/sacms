import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function SingleTypeEntryLoading() {
  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
      {/* Top Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
      </div>

      {/* Editor Form Card Feed */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>

        <div className="pt-4 border-t border-border/60 flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
      </Card>
    </div>
  )
}
