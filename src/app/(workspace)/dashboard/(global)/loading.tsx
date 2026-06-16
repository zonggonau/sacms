import { Loader2 } from "lucide-react"

export default function GlobalDashboardLoading() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-2 w-full max-w-sm">
          <div className="h-7 w-48 bg-muted rounded-md animate-pulse"></div>
          <div className="h-4 w-64 bg-muted/60 rounded-md animate-pulse"></div>
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-32 bg-muted rounded-md animate-pulse"></div>
          <div className="h-10 w-40 bg-muted rounded-md animate-pulse"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card shadow-sm border border-border p-6 rounded-xl flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3 w-24 bg-muted rounded animate-pulse"></div>
              <div className="h-8 w-12 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="h-8 w-8 bg-muted rounded-full animate-pulse"></div>
          </div>
        ))}
      </div>

      <div className="py-20 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading workspaces...</p>
      </div>
    </div>
  )
}
