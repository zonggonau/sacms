import { AlertTriangle, Inbox } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// The one place that says "nothing here yet" versus "something went wrong".
// Pages pass the ContentResult status straight through.
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Konten tidak bisa dimuat</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
