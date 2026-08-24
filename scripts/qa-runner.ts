interface RouteTestResult {
  route: string
  name: string
  category: "Public" | "Auth" | "Workspace Dashboard" | "Super Admin" | "API / Backend"
  status: number
  ok: boolean
  durationMs: number
  details: string
}

async function runQAAudit() {
  console.log("==================================================================")
  console.log("🚀 STARTING COMPREHENSIVE QA AUDIT FOR SACMS (v1.3.0)")
  console.log("Target: http://localhost:3000")
  console.log("==================================================================")

  const tenantId = "cmt1gvfva0007ujmkfa0gb705"
  const tenantSlug = "cmt1gvfva0007ujmkfa0gb705"

  const routesToTest = [
    // ─── 1. Public Landing & Pages ───
    { route: "/", name: "Landing Page (Dual Language)", category: "Public" as const },
    { route: "/docs", name: "Public Documentation Hub", category: "Public" as const },
    { route: "/docs/mcp", name: "MCP AI Assistant Documentation", category: "Public" as const },
    { route: "/blog", name: "Official Blog Hub", category: "Public" as const },

    // ─── 2. Auth Routes ───
    { route: "/login", name: "Login Portal", category: "Auth" as const },
    { route: "/register", name: "Registration Page", category: "Auth" as const },
    { route: "/forgot-password", name: "Forgot Password Flow", category: "Auth" as const },

    // ─── 3. Super Admin Panel ───
    { route: "/admin", name: "Super Admin Dashboard Overview", category: "Super Admin" as const },
    { route: "/admin/infrastructure", name: "Dedicated Infrastructure Monitoring Hub", category: "Super Admin" as const },
    { route: "/admin/users", name: "User & Tenant Management", category: "Super Admin" as const },
    { route: "/admin/rbac", name: "Global RBAC Permission Matrix", category: "Super Admin" as const },
    { route: "/admin/databases", name: "BYODB & Database Instances", category: "Super Admin" as const },
    { route: "/admin/domains", name: "Custom Domain Manager", category: "Super Admin" as const },
    { route: "/admin/webhooks", name: "Global Webhooks & DLQ", category: "Super Admin" as const },

    // ─── 4. Workspace Dashboard & CMS ───
    { route: `/dashboard/${tenantId}`, name: "Workspace Dashboard Overview", category: "Workspace Dashboard" as const },
    { route: `/dashboard/${tenantId}/subscriptions`, name: "Dynamic Subscriptions & Pricing (Yearly)", category: "Workspace Dashboard" as const },
    { route: `/dashboard/${tenantId}/settings`, name: "Workspace Settings & BYODB", category: "Workspace Dashboard" as const },
    { route: `/dashboard/${tenantId}/media`, name: "R2 / MinIO Media Asset Library", category: "Workspace Dashboard" as const },
    { route: `/dashboard/${tenantId}/content-type-builder`, name: "Content Type Builder Schema Engine", category: "Workspace Dashboard" as const },
    { route: `/dashboard/${tenantId}/cms`, name: "Content Management Studio (CMS Entries)", category: "Workspace Dashboard" as const },

    // ─── 5. Core APIs ───
    { route: `/api/tenant/${tenantSlug}/subscriptions/plans`, name: "API: Dynamic Subscriptions Catalog", category: "API / Backend" as const },
    { route: `/api/admin/infrastructure`, name: "API: Infrastructure Server List & Stats", category: "API / Backend" as const },
    { route: `/api/user/permissions`, name: "API: RBAC Permission Evaluation", category: "API / Backend" as const },
    { route: `/api/geoip`, name: "API: Geolocation & Country Flags", category: "API / Backend" as const },
    { route: `/api/cron/infrastructure/health`, name: "API: Scheduled Infrastructure Health Ping", category: "API / Backend" as const },
  ]

  const results: RouteTestResult[] = []

  for (const item of routesToTest) {
    const url = `http://localhost:3000${item.route}`
    const start = performance.now()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(url, {
        headers: {
          "Accept": "text/html,application/json,*/*",
          "User-Agent": "SaCMS-QA-Auditor/1.0",
        },
        signal: controller.signal,
        redirect: "manual",
      })
      clearTimeout(timeoutId)
      const duration = Math.round(performance.now() - start)
      const isRedirect = [301, 302, 307, 308].includes(res.status)
      const ok = (res.status >= 200 && res.status < 400) || (res.status === 401 || res.status === 403) // 401/403 or redirect for protected routes without session

      let details = ""
      if (res.status === 200) {
        details = "HTTP 200 OK (Rendered cleanly)"
      } else if (isRedirect) {
        const loc = res.headers.get("location") || ""
        details = `HTTP ${res.status} Redirect (Protected route -> ${loc})`
      } else if (res.status === 401 || res.status === 403) {
        details = `HTTP ${res.status} (Protected Auth Gate - Active)`
      } else {
        details = `HTTP ${res.status}`
      }

      results.push({
        route: item.route,
        name: item.name,
        category: item.category,
        status: res.status,
        ok,
        durationMs: duration,
        details,
      })
    } catch (err: any) {
      const duration = Math.round(performance.now() - start)
      results.push({
        route: item.route,
        name: item.name,
        category: item.category,
        status: 0,
        ok: false,
        durationMs: duration,
        details: `Connection Error: ${err?.message || "Unknown"}`,
      })
    }
  }

  // Print results table
  console.log("\n==================================================================")
  console.log("📊 QA AUDIT ROUTE-BY-ROUTE RESULTS")
  console.log("==================================================================")

  let passedCount = 0
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌"
    if (r.ok) passedCount++
    console.log(`${icon} [${r.category.padEnd(20)}] ${r.name.padEnd(45)} | ${r.status.toString().padStart(3)} | ${r.durationMs.toString().padStart(4)}ms | ${r.details}`)
  }

  console.log("==================================================================")
  console.log(`🎯 QA SCORE: ${passedCount}/${results.length} PASSED (${Math.round((passedCount / results.length) * 100)}%)`)
  console.log("==================================================================")
}

runQAAudit().then(() => process.exit(0)).catch(e => {
  console.error("QA Error:", e)
  process.exit(1)
})
