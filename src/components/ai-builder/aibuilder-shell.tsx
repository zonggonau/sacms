"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AiBuilderSidebar, type AiProjectItem } from "./aibuilder-sidebar"
import { AibuilderProjectsView } from "./aibuilder-projects-view"
import { V0TopNavbar, type WorkspaceOption } from "./v0-top-navbar"
import { WebsiteBuilderClient } from "@/app/(workspace)/developer/[tenant]/(developer)/content-type-builder/aiwebsitebuilder/website-builder-client"

interface AiBuilderShellProps {
  workspaces: WorkspaceOption[]
  projects: AiProjectItem[]
  activeTenant: {
    id: string
    name: string
    slug: string
    plan: string
  }
  credits: {
    remaining: number
    total: number
    isUnlimited: boolean
  }
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    role?: string | null
  }
  studioProps: {
    tenantId: string
    tenantSlug: string
    hasUpgradedPlan: boolean
    hasSchema: boolean
    initialProject: any
  }
}

export function AiBuilderShell({
  workspaces,
  projects,
  activeTenant,
  credits,
  user,
  studioProps,
}: AiBuilderShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")

  const [activeView, setActiveView] = useState<"builder" | "projects">(
    tabParam === "projects" ? "projects" : "builder"
  )
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // Sync tab state with URL query param if present
  useEffect(() => {
    if (tabParam === "projects") {
      setActiveView("projects")
    } else if (tabParam === "builder") {
      setActiveView("builder")
    }
  }, [tabParam])

  // Load sidebar collapsed state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sacms_aibuilder_sidebar_collapsed")
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true")
      }
    } catch {}
  }, [])

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem("sacms_aibuilder_sidebar_collapsed", String(next))
      } catch {}
      return next
    })
  }

  const handleSelectView = (view: "builder" | "projects") => {
    setActiveView(view)
    const currentParams = new URLSearchParams(window.location.search)
    currentParams.set("tab", view)
    router.push(`/aibuilder?${currentParams.toString()}`)
  }

  const handleOpenProject = (slug: string) => {
    setActiveView("builder")
    router.push(`/aibuilder?workspace=${slug}&tab=builder`)
  }

  const handleNewProject = () => {
    setActiveView("builder")
    router.push("/aibuilder?tab=builder")
  }

  return (
    <div className="aibuilder-theme flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* Sidebar (AI Builder & Projects Navigation) */}
      <AiBuilderSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        projects={projects}
        activeTenantSlug={activeTenant.slug}
        credits={credits}
        user={user}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        onNewProject={handleNewProject}
        onSelectProject={handleOpenProject}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navbar */}
        <V0TopNavbar
          workspaces={workspaces}
          activeTenant={activeTenant}
          credits={credits}
        />

        {/* Dynamic Main Body: Studio vs Projects View */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {activeView === "builder" ? (
            <main className="flex-1 overflow-hidden p-3 md:p-5">
              <WebsiteBuilderClient
                tenantId={studioProps.tenantId}
                tenantSlug={studioProps.tenantSlug}
                hasUpgradedPlan={studioProps.hasUpgradedPlan}
                hasSchema={studioProps.hasSchema}
                initialAiCredits={credits}
                initialProject={studioProps.initialProject}
              />
            </main>
          ) : (
            <AibuilderProjectsView
              projects={projects}
              onOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
            />
          )}
        </div>
      </div>
    </div>
  )
}
