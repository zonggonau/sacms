import Link from "next/link"
import { Lock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Blocks the AI Site landing prompt until the tenant's CMS schema is finalized — see src/lib/schema-lock.ts. */
export function SchemaNotFinalizedNotice({ tenantId }: { tenantId: string }) {
  return (
    <div className="flex h-full min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/10">
        <Lock className="size-6 text-amber-600 dark:text-amber-400" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Skema CMS belum difinalkan</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        AI Site baru bisa mulai membangun frontend setelah struktur Content Type, Single Type, dan Component-nya sudah pasti. Selesaikan dan finalkan skemanya dulu di Schema Builder.
      </p>
      <Button asChild className="mt-6 gap-1.5">
        <Link href={`/dashboard/${tenantId}/developer/schema`}>
          Buka Schema Builder <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </div>
  )
}
