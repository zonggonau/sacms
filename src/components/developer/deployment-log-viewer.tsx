"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusBadge } from "@/components/ui/status-badge"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"

export type DeploymentStatus = "success" | "failed" | "pending" | "running"

export interface DeploymentLog {
  id: string
  timestamp: Date
  status: DeploymentStatus
  action: string
  description?: string
  projectId?: string
}

interface DeploymentLogViewerProps {
  logs: DeploymentLog[]
  isLoading?: boolean
}

const statusMap: Record<DeploymentStatus, "published" | "failed" | "pending"> = {
  success: "published",
  failed: "failed",
  pending: "pending",
  running: "pending",
}

const statusLabels: Record<DeploymentStatus, string> = {
  success: "Success",
  failed: "Failed",
  pending: "Pending",
  running: "Running",
}

export function DeploymentLogViewer({ logs, isLoading = false }: DeploymentLogViewerProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        Loading deployment logs...
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No deployment logs found.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow variant="compact">
          <TableHead className="w-32">Timestamp</TableHead>
          <TableHead className="w-24">Status</TableHead>
          <TableHead>Action</TableHead>
          <TableHead className="w-48">Details</TableHead>
          <TableHead className="w-32">Project</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow key={log.id} variant="dense">
            <TableCell monospace className="text-xs">
              {log.timestamp.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
              <div className="text-muted-foreground text-xs mt-0.5">
                {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: id })}
              </div>
            </TableCell>
            <TableCell>
              <StatusBadge
                type={statusMap[log.status]}
                label={statusLabels[log.status]}
                size="sm"
              />
            </TableCell>
            <TableCell className="font-500">
              {log.action}
            </TableCell>
            <TableCell monospace>
              {log.description}
            </TableCell>
            <TableCell monospace className="text-xs">
              {log.projectId && (
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {log.projectId}
                </code>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
