import { Loader2 } from "lucide-react"

export default function AdminLoading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full h-full min-h-[50vh] p-12">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      <p className="text-sm text-muted-foreground mt-4 animate-pulse">Loading system data...</p>
    </div>
  )
}
