import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

export default function CMSDashboardLoading() {
  return (
    <div className="p-6 lg:p-10 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-muted rounded-xl animate-pulse"></div>
          <div className="h-4 w-48 bg-muted/60 rounded-xl animate-pulse"></div>
        </div>
        <div className="h-14 w-48 bg-muted rounded-2xl animate-pulse"></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="border border-border/80 shadow-xs bg-card rounded-2xl">
            <CardContent className="p-6 flex items-center gap-4">
              <div className="w-10 h-10 bg-muted shrink-0 rounded-xl border border-border/80 animate-pulse"></div>
              <div className="space-y-2 w-full">
                <div className="h-3 w-24 bg-muted rounded-md animate-pulse"></div>
                <div className="h-6 w-12 bg-muted rounded-md animate-pulse"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border border-border/80 shadow-xs bg-card rounded-2xl overflow-hidden h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </Card>
        <div className="space-y-6">
          <div className="h-48 w-full bg-muted rounded-2xl animate-pulse"></div>
          <div className="h-64 w-full bg-muted rounded-2xl animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}
