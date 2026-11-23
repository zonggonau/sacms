"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/format"
import { ChevronRight } from "lucide-react"

export interface BillingSummaryProps {
  accountName: string
  planName: string
  planPrice: number
  billingCycle: "monthly" | "yearly"
  nextBillingDate: Date
  storageUsed: number
  storageLimit: number
  workspacesUsed: number
  workspacesLimit: number
  status: "active" | "past_due" | "suspended"
}

const statusConfig = {
  active: {
    badge: "✓ Active",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/20",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  past_due: {
    badge: "⚠ Past Due",
    bgClass: "bg-amber-50 dark:bg-amber-950/20",
    textClass: "text-amber-700 dark:text-amber-300",
  },
  suspended: {
    badge: "✕ Suspended",
    bgClass: "bg-red-50 dark:bg-red-950/20",
    textClass: "text-red-700 dark:text-red-300",
  },
}

export function BillingSummaryCard({
  accountName,
  planName,
  planPrice,
  billingCycle,
  nextBillingDate,
  storageUsed,
  storageLimit,
  workspacesUsed,
  workspacesLimit,
  status,
}: BillingSummaryProps) {
  const config = statusConfig[status]
  const storagePercent = (storageUsed / storageLimit) * 100
  const workspacePercent = (workspacesUsed / workspacesLimit) * 100

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-600 text-foreground">{accountName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {planName} Plan
          </p>
        </div>
        <Badge className={`${config.bgClass} ${config.textClass} border-0`}>
          {config.badge}
        </Badge>
      </div>

      {/* Plan & Pricing */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b">
        <div>
          <div className="text-xs font-500 text-muted-foreground uppercase tracking-wide">
            Monthly Cost
          </div>
          <div className="text-2xl font-600 text-foreground mt-1">
            {formatCurrency(planPrice)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {billingCycle === "yearly" ? "Per year" : "Per month"}
          </div>
        </div>
        <div>
          <div className="text-xs font-500 text-muted-foreground uppercase tracking-wide">
            Next Billing
          </div>
          <div className="text-sm font-500 text-foreground mt-1">
            {nextBillingDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {Math.ceil(
              (nextBillingDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )}{" "}
            days away
          </div>
        </div>
      </div>

      {/* Resource Usage */}
      <div className="space-y-4">
        <h4 className="text-sm font-500 text-foreground">Resource Usage</h4>

        {/* Storage */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-500 text-muted-foreground">
              Storage
            </span>
            <span className="text-xs font-500 text-foreground">
              {storageUsed} / {storageLimit} GB
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-colors ${
                storagePercent > 90
                  ? "bg-red-500"
                  : storagePercent > 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(storagePercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Workspaces */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-500 text-muted-foreground">
              Workspaces
            </span>
            <span className="text-xs font-500 text-foreground">
              {workspacesUsed} / {workspacesLimit}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-colors ${
                workspacePercent > 90
                  ? "bg-red-500"
                  : workspacePercent > 70
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(workspacePercent, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Action */}
      <Button
        variant="secondary"
        className="w-full justify-between"
      >
        <span>Manage Billing</span>
        <ChevronRight className="size-4" />
      </Button>
    </Card>
  )
}
