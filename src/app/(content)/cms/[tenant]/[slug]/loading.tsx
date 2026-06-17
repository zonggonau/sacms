import { Loader2 } from "lucide-react"

export default function CMSContentTypeEntriesLoading() {
  return (
    <div className="p-6 lg:p-10 space-y-6 animate-in fade-in duration-300">
      <div className="sticky top-0 z-30 bg-background/95 pb-4 -mx-6 px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-md animate-pulse"></div>
            <div className="space-y-2">
              <div className="h-8 w-48 bg-muted rounded-md animate-pulse"></div>
              <div className="h-4 w-64 bg-muted/60 rounded-md animate-pulse"></div>
            </div>
          </div>
          <div className="h-11 w-36 bg-muted rounded-md animate-pulse"></div>
        </div>
      </div>

      <div className="border border-border shadow-none bg-card p-4 flex gap-4 animate-pulse">
        <div className="h-10 w-full max-w-sm bg-muted rounded-md"></div>
        <div className="h-10 w-32 bg-muted rounded-md"></div>
      </div>

      <div className="border border-border shadow-none overflow-hidden bg-card rounded-none h-[500px] flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm font-medium">Fetching content entries...</p>
      </div>
    </div>
  )
}
