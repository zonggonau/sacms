"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatusBorderIndicator } from "@/components/ui/status-badge"
import { formatDistanceToNow } from "date-fns"
import { id } from "date-fns/locale"
import { Check, X, Clock } from "lucide-react"

export type ApprovalStatus = "pending" | "approved" | "rejected"

export interface ApprovalRequest {
  id: string
  title: string
  description: string
  requestedBy: string
  requestedAt: Date
  status: ApprovalStatus
  action: string
  targetId?: string
  estimatedImpact?: string
}

interface ApprovalRequestCardProps {
  request: ApprovalRequest
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  isLoading?: boolean
}

const statusLabels: Record<ApprovalStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
}

export function ApprovalRequestCard({
  request,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalRequestCardProps) {
  const isPending = request.status === "pending"

  return (
    <Card className="p-4 overflow-hidden">
      <div className="flex gap-3">
        {/* Left Border Indicator */}
        <div className="w-1 flex-shrink-0">
          <StatusBorderIndicator
            type={
              request.status === "approved"
                ? "published"
                : request.status === "rejected"
                  ? "failed"
                  : "pending"
            }
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-600 text-foreground truncate">
                {request.title}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {request.description}
              </p>
            </div>
            <div
              className={`text-xs px-2 py-1 rounded whitespace-nowrap font-500 ${
                isPending
                  ? "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                  : request.status === "approved"
                    ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300"
              }`}
            >
              {statusLabels[request.status]}
            </div>
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-3">
            <div className="flex items-center gap-1">
              <Clock className="size-3" />
              Requested by {request.requestedBy}
            </div>
            <div>
              {formatDistanceToNow(request.requestedAt, {
                addSuffix: true,
                locale: id,
              })}
            </div>
            {request.action && (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                {request.action}
              </code>
            )}
          </div>

          {request.estimatedImpact && (
            <div className="bg-muted/50 p-2 rounded text-xs text-foreground mb-3">
              <span className="font-500">Impact:</span> {request.estimatedImpact}
            </div>
          )}

          {/* Actions */}
          {isPending && (onApprove || onReject) && (
            <div className="flex gap-2">
              {onApprove && (
                <Button
                  size="sm"
                  onClick={() => onApprove(request.id)}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <Check className="size-3" />
                  Approve
                </Button>
              )}
              {onReject && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReject(request.id)}
                  disabled={isLoading}
                  className="flex items-center gap-1"
                >
                  <X className="size-3" />
                  Reject
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
