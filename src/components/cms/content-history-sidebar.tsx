"use client"

import { useState, useEffect } from "react"
import { 
  History, Clock, RotateCcw, User, 
  CheckCircle2, FileText, AlertCircle, Loader2,
  ChevronRight, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/sheet" // Note: adjust based on actual path
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

// Fallback if Sheet is not in @/sheet
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface Version {
  id: string
  version: number
  changeType: string
  changedBy: string | null
  changeSummary: string | null
  createdAt: string
  publishedAt: string | null
}

interface ContentHistorySidebarProps {
  tenantSlug: string
  contentTypeSlug: string
  entryId: string
  onRestoreSuccess: (newData: any) => void
}

export function ContentHistorySidebar({
  tenantSlug,
  contentTypeSlug,
  entryId,
  onRestoreSuccess
}: ContentHistorySidebarProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[]>([])

  const fetchVersions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions`)
      if (res.ok) {
        const data = await res.json()
        setVersions(data.versions || [])
      }
    } catch (error) {
      console.error("Error fetching versions:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) fetchVersions()
  }, [open, entryId])

  const handleRestore = async (versionId: string) => {
    if (!confirm("Are you sure you want to restore this version? Current unsaved changes will be lost.")) return
    
    setRestoring(versionId)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      })
      
      if (res.ok) {
        const data = await res.json()
        toast({ 
          title: "Version Restored", 
          description: "The content has been reverted to the selected version.",
          className: "bg-emerald-50 border-emerald-200 text-emerald-800"
        })
        onRestoreSuccess(data.entry.data)
        setOpen(false)
      } else {
        toast({ variant: "destructive", title: "Restore Failed" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Something went wrong" })
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-xl font-bold border-emerald-100 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100">
          <History className="mr-2 h-4 w-4" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <History className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-white">Revision History</DialogTitle>
              <DialogDescription className="text-emerald-50/80 font-medium">
                View and restore previous versions of this content.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-0 bg-card">
          <ScrollArea className="h-[500px]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading history...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-6 w-6 opacity-20" />
                </div>
                <p className="font-bold text-sm">No revisions found.</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {versions.map((v, i) => (
                  <div key={v.id} className={cn(
                    "relative p-4 rounded-2xl border transition-all group",
                    i === 0 ? "border-emerald-200 bg-emerald-50/30" : "border-muted hover:border-emerald-100 hover:bg-muted/30"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={i === 0 ? "default" : "outline"} className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0",
                            i === 0 ? "bg-emerald-500" : "text-muted-foreground"
                          )}>
                            v{v.version} {i === 0 && "(Current)"}
                          </Badge>
                          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {new Date(v.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-foreground mt-2">
                          {v.changeSummary || (v.changeType === 'created' ? 'Initial Creation' : v.changeType === 'restored' ? 'Version Restored' : 'Content Updated')}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
                          <User className="h-3 w-3" />
                          <span>ID: {v.changedBy?.substring(0,8) || 'System'}</span>
                        </div>
                      </div>
                      
                      {i !== 0 && (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          disabled={!!restoring}
                          onClick={() => handleRestore(v.id)}
                          className="h-8 rounded-lg font-black text-[10px] uppercase tracking-widest text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700"
                        >
                          {restoring === v.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RotateCcw className="h-3 w-3 mr-1" />
                          )}
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
