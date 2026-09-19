import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function SubscriptionsCheckoutLoading() {
  return (
    <div className="flex flex-1 flex-col w-full">
      <div className="flex-1 bg-background text-foreground flex flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 w-full max-w-5xl mx-auto space-y-6">
          
          {/* Header Skeleton */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-3.5 w-72 rounded-md" />
            </div>
          </div>

          {/* Grid Layout Skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column (2 Cols) */}
            <div className="lg:col-span-2 space-y-4">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded-md" />
                  </div>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border/60">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-4 w-40 rounded-md" />
                        <Skeleton className="h-3 w-28 rounded-md" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-24 rounded-lg" />
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24 rounded-md" />
                      <Skeleton className="h-3.5 w-20 rounded-md" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-20 rounded-md" />
                      <Skeleton className="h-3.5 w-20 rounded-md" />
                    </div>
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24 rounded-md" />
                      <Skeleton className="h-3.5 w-16 rounded-md" />
                    </div>
                    <div className="h-px bg-border my-2" />
                    <div className="flex justify-between pt-1">
                      <Skeleton className="h-5 w-32 rounded-md" />
                      <Skeleton className="h-7 w-36 rounded-md" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Security Banner Skeleton */}
              <div className="p-4 bg-muted/20 border border-border/60 rounded-xl flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-md shrink-0" />
                <Skeleton className="h-3.5 w-full rounded-md" />
              </div>
            </div>

            {/* Right Column (1 Col) */}
            <div className="space-y-4">
              <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
                <CardHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
                  <Skeleton className="h-3.5 w-36 rounded-md" />
                </CardHeader>
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-20 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded-md" />
                  </div>
                  <div className="space-y-1.5">
                    <Skeleton className="h-2.5 w-20 rounded-md" />
                    <Skeleton className="h-6 w-28 rounded-lg" />
                  </div>
                  <div className="h-px bg-border" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                  <Skeleton className="h-3 w-4/5 mx-auto rounded-md" />
                </CardContent>
              </Card>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
