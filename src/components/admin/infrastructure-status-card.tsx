"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

export type ServiceStatus = "healthy" | "degraded" | "down"

export interface ServiceMetric {
  name: string
  status: ServiceStatus
  uptime: number
  latency?: number
  lastChecked: Date
}

interface InfrastructureStatusCardProps {
  services: ServiceMetric[]
  overallStatus: ServiceStatus
}

const statusConfig: Record<ServiceStatus, { icon: React.ComponentType<{ className?: string }>, bg: string, text: string, label: string }> = {
  healthy: {
    icon: CheckCircle2,
    bg: "bg-emerald-100 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-300",
    label: "Healthy",
  },
  degraded: {
    icon: AlertCircle,
    bg: "bg-amber-100 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-300",
    label: "Degraded",
  },
  down: {
    icon: AlertCircle,
    bg: "bg-red-100 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-300",
    label: "Down",
  },
}

export function InfrastructureStatusCard({
  services,
  overallStatus,
}: InfrastructureStatusCardProps) {
  const config = statusConfig[overallStatus]
  const StatusIcon = config.icon

  return (
    <Card className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-600 text-foreground">
            Infrastructure Status
          </h3>
        </div>
        <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded", config.bg)}>
          <StatusIcon className={cn("size-5", config.text)} />
          <span className={cn("text-sm font-500", config.text)}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {services.map((service) => {
          const serviceConfig = statusConfig[service.status]
          const ServiceIcon = serviceConfig.icon

          return (
            <div
              key={service.name}
              className={cn(
                "p-3 rounded border",
                service.status === "healthy"
                  ? "border-emerald-200 dark:border-emerald-900/30"
                  : service.status === "degraded"
                    ? "border-amber-200 dark:border-amber-900/30"
                    : "border-red-200 dark:border-red-900/30"
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ServiceIcon className={cn("size-4", serviceConfig.text)} />
                  <span className="text-sm font-500 text-foreground">
                    {service.name}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs", serviceConfig.bg, serviceConfig.text)}
                >
                  {serviceConfig.label}
                </Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Uptime</span>
                  <span className="font-500">{service.uptime}%</span>
                </div>
                {service.latency !== undefined && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Zap className="size-3" /> Latency
                    </span>
                    <span className="font-500 font-mono">
                      {service.latency.toFixed(0)}ms
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Checked</span>
                  <span className="font-mono">
                    {service.lastChecked.toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t text-xs text-muted-foreground">
        <p>
          Last updated{" "}
          {new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
        <p>Status checks run every 60 seconds</p>
      </div>
    </Card>
  )
}
