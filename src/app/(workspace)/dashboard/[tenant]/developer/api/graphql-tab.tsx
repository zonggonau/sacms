"use client"

import { GraphiQLWrapper } from "@/components/cms/graphiql-wrapper"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Key, Sparkles } from "lucide-react"
import Link from "next/link"

interface GraphQLTabProps {
  tenantSlug: string
  selectedToken?: string
}

export function GraphQLTab({ tenantSlug, selectedToken }: GraphQLTabProps) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  const endpoint = `${origin}/api/public/${tenantSlug}/graphql`

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <Card className="rounded-2xl border border-border/80 shadow-xs bg-card overflow-hidden">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-foreground">GraphQL Endpoint:</span>
                <code className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded-lg border border-border/60 text-primary font-semibold">
                  {endpoint}
                </code>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Tambahkan header <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px] text-foreground font-semibold">Authorization: Bearer &lt;TOKEN&gt;</code> di panel Headers Sandbox bawah.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs font-bold shrink-0 border-border/80" asChild>
            <Link href={`/dashboard/${tenantSlug}/developer/api-keys`}>
              <Key className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Kelola Token
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="h-[650px] border border-border/80 rounded-2xl overflow-hidden bg-background shadow-xs" style={{ isolation: "isolate" }}>
        <GraphiQLWrapper endpoint={endpoint} />
      </div>
    </div>
  )
}
