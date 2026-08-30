import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export default function CMSContentTypeEntriesLoading() {
  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-7xl mx-auto w-full animate-in fade-in duration-300">
      {/* Top Header Feed */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/60">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48 rounded-lg" />
              <Skeleton className="h-5 w-14 rounded-full" />
            </div>
            <Skeleton className="h-3.5 w-64 max-w-full rounded-md" />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
      </div>

      {/* Filter & Search Toolbar Feed */}
      <div className="border border-border/80 shadow-xs bg-card p-4 rounded-2xl flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <Skeleton className="h-9 w-full sm:w-72 rounded-xl" />
          <Skeleton className="h-9 w-32 rounded-xl shrink-0" />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
        </div>
      </div>

      {/* Full Content Table Feed */}
      <Card className="border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr>
                  <th className="p-4 w-10"><Skeleton className="h-4 w-4 rounded" /></th>
                  <th className="p-4 font-semibold text-xs text-muted-foreground"><Skeleton className="h-3.5 w-28 rounded" /></th>
                  <th className="p-4 font-semibold text-xs text-muted-foreground"><Skeleton className="h-3.5 w-16 rounded" /></th>
                  <th className="p-4 font-semibold text-xs text-muted-foreground"><Skeleton className="h-3.5 w-16 rounded" /></th>
                  <th className="p-4 font-semibold text-xs text-muted-foreground"><Skeleton className="h-3.5 w-20 rounded" /></th>
                  <th className="p-4 font-semibold text-xs text-muted-foreground text-right"><Skeleton className="h-3.5 w-12 ml-auto rounded" /></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4"><Skeleton className="h-4 w-4 rounded" /></td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-4 w-48 rounded" />
                          <Skeleton className="h-3 w-28 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="p-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="p-4"><Skeleton className="h-5 w-10 rounded-md" /></td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-24 rounded" />
                        <Skeleton className="h-2.5 w-16 rounded" />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Skeleton className="h-8 w-8 rounded-lg" />
                        <Skeleton className="h-8 w-8 rounded-lg" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer Feed */}
          <div className="p-4 border-t border-border/60 flex items-center justify-between">
            <Skeleton className="h-4 w-36 rounded" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
