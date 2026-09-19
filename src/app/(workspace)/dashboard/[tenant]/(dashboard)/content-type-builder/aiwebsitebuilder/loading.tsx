import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function AiWebsiteBuilderLoading() {
  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] flex-col p-4 md:p-6 lg:p-8 space-y-6 w-full animate-in fade-in duration-300">
      {/* Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-7 w-56 rounded-xl" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3.5 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
        </div>
      </div>

      {/* Main Builder Split Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Prompt & Model Cockpit */}
        <div className="lg:col-span-5 space-y-5 flex flex-col justify-between">
          <Card className="border border-border/80 shadow-xs bg-card rounded-2xl p-5 space-y-4 flex-1">
            <div className="space-y-2">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-28 w-full rounded-xl" />
            </div>

            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-28 rounded-md" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-7 w-24 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-32 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </Card>

          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>

        {/* Right Column: Visual Preview Panel */}
        <Card className="lg:col-span-7 border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-48 ml-3 rounded" />
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col justify-center items-center space-y-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3.5 w-64 rounded-md" />
            <div className="w-full max-w-md space-y-2 pt-4">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-2 w-3/4 mx-auto rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
