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
import ReactDiffViewer from "react-diff-viewer-continued"

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
  currentData?: any
  onRestoreSuccess: (newData: any) => void
}

export function ContentHistorySidebar({
  tenantSlug,
  contentTypeSlug,
  entryId,
  currentData = {},
  onRestoreSuccess
}: ContentHistorySidebarProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [diffVersionId, setDiffVersionId] = useState<string | null>(null)
  const [diffData, setDiffData] = useState<any>(null)
  const [loadingDiff, setLoadingDiff] = useState(false)

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
          className: "bg-muted border border-border text-foreground rounded-none shadow-none"
        })
        onRestoreSuccess(data.entry.data)
        setOpen(false)
        setDiffVersionId(null)
      } else {
        toast({ variant: "destructive", title: "Restore Failed" })
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Something went wrong" })
    } finally {
      setRestoring(null)
    }
  }

  const handleDiff = async (versionId: string) => {
    setLoadingDiff(true)
    setDiffVersionId(versionId)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/content-types/slug/${contentTypeSlug}/entries/${entryId}/versions/${versionId}`)
      if (res.ok) {
        const data = await res.json()
        setDiffData(data.version.data)
      }
    } catch (error) {
      console.error("Error fetching version data for diff:", error)
      toast({ variant: "destructive", title: "Failed to load version data" })
      setDiffVersionId(null)
    } finally {
      setLoadingDiff(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 rounded-none font-bold border border-border bg-card shadow-none hover:bg-muted hover:border-orange-500 transition-colors text-foreground">
          <History className="mr-2 h-4 w-4" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden border border-border shadow-none rounded-none bg-card">
        <div className="bg-muted p-6 border-b border-border text-foreground flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-none bg-muted border border-border flex items-center justify-center">
              <History className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight text-foreground">
                {diffVersionId ? "Version Diff" : "Revision History"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                {diffVersionId ? "Comparing current unsaved state with past version" : "View and restore previous versions of this content."}
              </DialogDescription>
            </div>
          </div>
          {diffVersionId && (
            <Button variant="outline" size="sm" onClick={() => setDiffVersionId(null)} className="rounded-none border border-border">
              Back to List
            </Button>
          )}
        </div>

        <div className="p-0 bg-card">
          <ScrollArea className="h-[600px]">
            {diffVersionId ? (
              <div className="p-0">
                {loadingDiff ? (
                  <div className="flex flex-col items-center justify-center h-[500px] gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading diff...</p>
                  </div>
                ) : (
                  <div className="p-4">
                    <ReactDiffViewer 
                      oldValue={JSON.stringify(diffData || {}, null, 2)} 
                      newValue={JSON.stringify(currentData || {}, null, 2)} 
                      splitView={true}
                      leftTitle={`Version Data`}
                      rightTitle={`Current Editor Data`}
                      useDarkTheme={false}
                    />
                    <div className="mt-6 flex justify-end p-4 border-t border-border">
                      <Button 
                        onClick={() => handleRestore(diffVersionId)}
                        disabled={!!restoring}
                        className="bg-orange-500 hover:bg-orange-600 text-white rounded-none font-bold uppercase tracking-widest"
                      >
                        {restoring === diffVersionId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                        Restore This Version
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : loading ? (
              <div className="flex flex-col items-center justify-center h-full py-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loading history...</p>
              </div>
            ) : versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <div className="w-12 h-12 rounded-none border border-border bg-muted flex items-center justify-center">
                  <Clock className="h-6 w-6 opacity-20" />
                </div>
                <p className="font-bold text-sm">No revisions found.</p>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {versions.map((v, i) => (
                  <div key={v.id} className={cn(
                    "relative p-4 rounded-none border transition-all group",
                    i === 0 ? "border-zinc-900 bg-zinc-50 dark:border-zinc-50 dark:bg-zinc-900" : "border-border hover:border-orange-500 hover:bg-muted/30"
                  )}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={i === 0 ? "default" : "outline"} className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0 rounded-none border",
                            i === 0 ? "bg-zinc-950 text-white border-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:border-zinc-50" : "text-muted-foreground border-border"
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
                        <div className="flex flex-col gap-2">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleDiff(v.id)}
                            className="h-7 rounded-none border border-border bg-card shadow-none font-black text-[10px] uppercase tracking-widest text-foreground hover:bg-muted transition-colors"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            View Diff
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            disabled={!!restoring}
                            onClick={() => handleRestore(v.id)}
                            className="h-7 rounded-none border border-border bg-card shadow-none font-black text-[10px] uppercase tracking-widest text-foreground hover:bg-muted hover:border-orange-500 transition-colors"
                          >
                            {restoring === v.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <RotateCcw className="h-3 w-3 mr-1" />
                            )}
                            Restore
                          </Button>
                        </div>
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
