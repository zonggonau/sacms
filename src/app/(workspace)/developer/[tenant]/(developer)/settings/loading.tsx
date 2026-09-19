import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SettingsLoading() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="space-y-1.5 pb-2 border-b border-border/60">
        <Skeleton className="h-8 w-56 rounded-xl" />
        <Skeleton className="h-3.5 w-80 max-w-full rounded-md" />
      </div>

      {/* Tabs Navigation Feed */}
      <div className="flex gap-2 border-b border-border/60 pb-2 overflow-x-auto">
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-28 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
        <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
      </div>

      {/* Form Settings Card Feed */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-6 space-y-6">
        <div className="space-y-1.5 border-b border-border/60 pb-4">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-3.5 w-64 rounded-md" />
        </div>

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
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>

        <div className="pt-4 border-t border-border/60 flex justify-end">
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </Card>
    </div>
  )
}
