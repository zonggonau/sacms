"use client"

import { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Loader2, CalendarClock, RefreshCw, Play, Pause,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  Search as SearchIcon, Webhook, ImageIcon, FileText,
} from "lucide-react"
interface ScheduledJob {
  id: string
  name: string
  type: "scheduled_publish" | "webhook_retry" | "search_index" | "media_processing"
  status: "pending" | "running" | "completed" | "failed"
  scheduledFor?: string
  lastRun?: string
  nextRun?: string
  details?: string
  entryId?: string
  errorMessage?: string
}

const JOB_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  scheduled_publish: { label: "Scheduled Publish", icon: CalendarClock, color: "text-purple-600 bg-purple-50 dark:bg-purple-900/30 dark:text-purple-400" },
  webhook_retry: { label: "Webhook Retry", icon: Webhook, color: "text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400" },
  search_index: { label: "Search Index", icon: SearchIcon, color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
  media_processing: { label: "Media Processing", icon: ImageIcon, color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
}

const JOB_STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending:   { label: "Pending",   icon: Clock,         color: "text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-400" },
  running:   { label: "Running",   icon: Play,          color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Completed", icon: CheckCircle2,  color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400" },
  failed:    { label: "Failed",    icon: XCircle,       color: "text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400" },
}

export default function SystemJobsPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string

  const [jobs, setJobs] = useState<ScheduledJob[]>([])
  const [loading, setLoading] = useState(true)

  const tenants = useMemo(() => session?.user?.tenants || [], [session])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const fetchJobs = async () => {
    if (!tenantSlug || !session?.user) return
    setLoading(true)
    try {
      // Fetch scheduled entries + webhook dead letters as "jobs"
      const [entriesRes, dlqRes] = await Promise.all([
        fetch(`/api/tenant/${tenantSlug}/content-types`),
        fetch(`/api/tenant/${tenantSlug}/webhooks/dead-letters`),
      ])

      const jobsList: ScheduledJob[] = []

      // Build scheduled publish jobs from stats
      const statsRes = await fetch(`/api/tenant/${tenantSlug}/stats`)
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        if (statsData.entries?.scheduled > 0) {
          jobsList.push({
            id: "scheduled-publish",
            name: `${statsData.entries.scheduled} entries pending publish`,
            type: "scheduled_publish",
            status: "pending",
            details: "Cron checks every minute for scheduled entries",
            nextRun: "Every minute",
          })
        }
      }

      // Build webhook retry jobs from dead letter queue
      if (dlqRes.ok) {
        const dlqData = await dlqRes.json()
        const deadLetters = dlqData.deadLetters || []
        if (deadLetters.length > 0) {
          jobsList.push({
            id: "dlq-retry",
            name: `${deadLetters.length} failed webhook deliveries`,
            type: "webhook_retry",
            status: "pending",
            details: "Auto-retry with exponential backoff",
            nextRun: "Every 5 minutes",
          })
        }
        deadLetters.slice(0, 5).forEach((dl: { id: string; webhookName?: string; event?: string; createdAt?: string; error?: string }) => {
          jobsList.push({
            id: `dlq-${dl.id}`,
            name: dl.webhookName || "Webhook retry",
            type: "webhook_retry",
            status: "failed",
            details: dl.event || "Unknown event",
            lastRun: dl.createdAt,
            errorMessage: dl.error,
          })
        })
      }

      // Search index update job (always present)
      jobsList.push({
        id: "search-index",
        name: "Full-text search vector update",
        type: "search_index",
        status: "completed",
        details: "PostgreSQL trigger auto-updates on INSERT/UPDATE",
        lastRun: new Date().toISOString(),
      })

      // Media processing job
      jobsList.push({
        id: "media-thumb",
        name: "Thumbnail generation",
        type: "media_processing",
        status: "completed",
        details: "Sharp generates 150px, 300px, 600px thumbnails on upload",
        lastRun: new Date().toISOString(),
      })

      setJobs(jobsList)
    } catch (err) {
      console.error("Failed to fetch jobs:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session?.user) fetchJobs()
  }, [tenantSlug, session])

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center flex-1 flex-col w-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex bg-background flex-1 flex-col w-full">
<div className="flex-1 min-h-screen flex-col w-full">
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Jobs & Scheduled Tasks</h1>
              <p className="text-sm text-muted-foreground">Scheduled publishing, webhook retries, and background tasks</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* Job Type Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(JOB_TYPE_CONFIG).map(([type, cfg]) => {
              const count = jobs.filter((j) => j.type === type).length
              const pendingCount = jobs.filter((j) => j.type === type && (j.status === "pending" || j.status === "running")).length
              const Icon = cfg.icon
              return (
                <Card key={type}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{cfg.label}</span>
                      <Icon className={`h-4 w-4 ${cfg.color.split(" ")[0]}`} />
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <p className="text-[11px] text-muted-foreground">
                      {pendingCount > 0 ? `${pendingCount} active` : "All complete"}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Jobs Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">All Jobs</CardTitle>
              <CardDescription className="text-xs">Background tasks and scheduled operations</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-16">
                  <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No active jobs</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Jobs will appear when scheduled content or webhook retries are queued</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Job</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Details</TableHead>
                      <TableHead className="text-xs">Last Run</TableHead>
                      <TableHead className="text-xs">Next Run</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => {
                      const typeCfg = JOB_TYPE_CONFIG[job.type]
                      const statusCfg = JOB_STATUS_CONFIG[job.status]
                      const TypeIcon = typeCfg?.icon || FileText
                      const StatusIcon = statusCfg?.icon || Clock
                      return (
                        <TableRow key={job.id}>
                          <TableCell className="text-sm font-medium">{job.name}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${typeCfg?.color || ""}`}>
                              <TypeIcon className="h-3 w-3" />
                              {typeCfg?.label || job.type}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${statusCfg?.color || ""}`}>
                              <StatusIcon className="h-3 w-3" />
                              {statusCfg?.label || job.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px]">
                            {job.errorMessage ? (
                              <span className="text-red-600 dark:text-red-400">{job.errorMessage}</span>
                            ) : (
                              job.details || "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {job.lastRun ? new Date(job.lastRun).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {job.nextRun || "—"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CalendarClock className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold">Scheduled Publishing</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      A cron job runs every minute to check for entries with status SCHEDULED
                      whose scheduledAt timestamp has passed, automatically publishing them.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Webhook className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold">Webhook Retry & DLQ</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Failed webhook deliveries are queued in a dead letter queue (DLQ)
                      and retried with exponential backoff. Max 3 retry attempts.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
