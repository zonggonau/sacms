"use client"

import Link from "next/link"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Database, Settings, ChevronRight, ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { ContentTypeGroupNode } from "@/lib/content-type-groups"

export interface SidebarContentType {
  id: string
  name: string
  slug: string
  groupId: string | null
  groupOrder: number
}

interface RowProps {
  tenantId: string
  pathname: string
  canGoBack: boolean
  href: (path: string) => string
}

export function ContentTypeRow({ ct, ...props }: RowProps & { ct: SidebarContentType }) {
  const { tenantId, pathname, canGoBack, href } = props
  const active = pathname.startsWith(href(`/content/${ct.slug}`))
  return (
    <div className="relative group">
      <Link href={href(`/content/${ct.slug}`)}>
        <div className={cn(
          "flex items-center gap-2.5 px-3 py-2 text-xs font-semibold transition-all rounded-xl",
          active
            ? "bg-primary text-primary-foreground font-bold shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}>
          <Database className={cn("h-4 w-4 shrink-0 transition-transform group-hover:scale-105", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
          <span className="truncate flex-1 pr-6">{ct.name}</span>
          {!canGoBack && (
            <ChevronRight className={cn("h-3 w-3 transition-opacity", active ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
          )}
        </div>
      </Link>
      {canGoBack && (
        <Link
          href={`/dashboard/${tenantId}/developer/content-types/edit/${ct.slug}`}
          title={`Edit Skema ${ct.name}`}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100",
            active
              ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20"
              : "text-muted-foreground hover:text-primary hover:bg-muted"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  )
}

function groupContainsActivePath(
  group: ContentTypeGroupNode,
  pathname: string,
  href: (path: string) => string,
  contentTypesByGroup: Map<string, SidebarContentType[]>,
): boolean {
  const own = contentTypesByGroup.get(group.id) || []
  if (own.some((ct) => pathname.startsWith(href(`/content/${ct.slug}`)))) return true
  return group.children.some((child) => groupContainsActivePath(child, pathname, href, contentTypesByGroup))
}

export function GroupNode({
  group,
  contentTypesByGroup,
  ...props
}: RowProps & { group: ContentTypeGroupNode; contentTypesByGroup: Map<string, SidebarContentType[]> }) {
  const { tenantId, pathname, canGoBack, href } = props
  const [open, setOpen] = useState(() => groupContainsActivePath(group, pathname, href, contentTypesByGroup))
  const ownContentTypes = (contentTypesByGroup.get(group.id) || []).slice().sort((a, b) => a.groupOrder - b.groupOrder)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-muted-foreground hover:text-foreground hover:bg-muted/60">
        <span className="truncate">{group.name}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3 border-l border-border/60 ml-3 space-y-1 mt-1">
        {group.children.map((child) => (
          <GroupNode key={child.id} group={child} contentTypesByGroup={contentTypesByGroup} {...props} />
        ))}
        {ownContentTypes.map((ct) => (
          <ContentTypeRow key={ct.id} ct={ct} {...props} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}
