"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface APIEndpointCardProps {
  method: HTTPMethod
  endpoint: string
  description: string
  tags?: string[]
  deprecated?: boolean
  authentication?: "required" | "optional" | "none"
}

const methodColors: Record<HTTPMethod, string> = {
  GET: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  POST: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  PUT: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  PATCH: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
}

export function APIEndpointCard({
  method,
  endpoint,
  description,
  tags,
  deprecated = false,
  authentication = "required",
}: APIEndpointCardProps) {
  return (
    <Card className={cn(
      "p-4 border-l-4",
      deprecated && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-start gap-3 flex-1">
          <Badge variant="outline" className={cn("font-mono font-600 text-xs", methodColors[method])}>
            {method}
          </Badge>
          <div className="flex-1 min-w-0">
            <code className="font-mono text-sm break-all text-foreground">
              {endpoint}
            </code>
            {deprecated && (
              <div className="text-xs text-muted-foreground mt-1">
                ⚠️ Deprecated
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-sm text-foreground mb-3">
        {description}
      </p>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {authentication !== "none" && (
          <span>
            🔒 {authentication === "required" ? "Auth required" : "Auth optional"}
          </span>
        )}
        {tags && tags.length > 0 && (
          <div className="flex gap-1.5">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs font-400"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}
