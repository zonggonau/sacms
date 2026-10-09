import { db } from "@/lib/database";

export interface RouteTestResult {
  route: string;
  name: string;
  category: "Public" | "Auth" | "Super Admin" | "Developer Hub" | "CMS Studio" | "API / Backend";
  status: number;
  ok: boolean;
  durationMs: number;
  details: string;
}

export async function runQAAudit(customBaseUrl?: string) {
  const baseUrl = (customBaseUrl || process.env.BASE_URL || process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

  console.log("==================================================================");
  console.log("🚀 STARTING COMPREHENSIVE QA AUDIT FOR SACMS");
  console.log(`Target: ${baseUrl}`);
  console.log("==================================================================");

  // Dynamically resolve an active tenant for testing
  let tenantSlug = "demo";
  try {
    const tenant = await db.tenant.findFirst({
      where: { status: "active" },
      select: { id: true, slug: true },
    });
    if (tenant?.slug) {
      tenantSlug = tenant.slug;
    }
  } catch {
    // If DB is offline, continue with default fallback slug
  }

  const routesToTest = [
    // ─── 1. Public Landing & Pages ───
    { route: "/", name: "Landing Page", category: "Public" as const },
    { route: "/docs", name: "Public Documentation Hub", category: "Public" as const },
    { route: "/docs/mcp", name: "MCP AI Assistant Documentation", category: "Public" as const },
    { route: "/blog", name: "Official Blog Hub", category: "Public" as const },

    // ─── 2. Auth Routes ───
    { route: "/auth/login", name: "Login Portal", category: "Auth" as const },
    { route: "/auth/register", name: "Registration Page", category: "Auth" as const },
    { route: "/auth/forgot-password", name: "Forgot Password Flow", category: "Auth" as const },

    // ─── 3. Super Admin Panel ───
    { route: "/admin", name: "Super Admin Dashboard Overview", category: "Super Admin" as const },
    { route: "/admin/infrastructure", name: "Infrastructure Monitoring Hub", category: "Super Admin" as const },
    { route: "/admin/users", name: "User & Tenant Management", category: "Super Admin" as const },
    { route: "/admin/rbac", name: "Global RBAC Permission Matrix", category: "Super Admin" as const },
    { route: "/admin/databases", name: "BYODB & Database Instances", category: "Super Admin" as const },
    { route: "/admin/domains", name: "Custom Domain Manager", category: "Super Admin" as const },
    { route: "/admin/webhooks", name: "Global Webhooks & DLQ", category: "Super Admin" as const },

    // ─── 4. Developer Hub (Workspace Scope) ───
    { route: `/developer/${tenantSlug}`, name: "Workspace Hub & Overview", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/content-types`, name: "Content Types Management", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/content-type-builder`, name: "Content Type Schema Builder", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/infrastructure`, name: "Hosting & Infrastructure Panel", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/subscriptions`, name: "Billing & Plans Panel", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/users`, name: "Team Members & RBAC Roles", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/settings`, name: "Workspace Settings", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/tools/api-keys`, name: "API Key Management", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/tools/webhooks`, name: "Webhook CRUD & Activity Logs", category: "Developer Hub" as const },
    { route: `/developer/${tenantSlug}/tools/docs`, name: "Interactive Swagger API Docs", category: "Developer Hub" as const },

    // ─── 5. CMS Studio ───
    { route: `/cms/${tenantSlug}`, name: "CMS Studio Hub", category: "CMS Studio" as const },
    { route: `/cms/${tenantSlug}/media`, name: "Media Asset Library", category: "CMS Studio" as const },

    // ─── 6. Core APIs ───
    { route: "/api/health", name: "API: System Health Check", category: "API / Backend" as const },
    { route: "/api/geoip", name: "API: Geolocation & Flags", category: "API / Backend" as const },
    { route: "/api/admin/infrastructure", name: "API: Infrastructure Monitoring", category: "API / Backend" as const },
    { route: `/api/public/${tenantSlug}/brand`, name: "API: White-Label Brand Info", category: "API / Backend" as const },
  ];

  const results: RouteTestResult[] = [];

  for (const item of routesToTest) {
    const url = `${baseUrl}${item.route}`;
    const start = performance.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(url, {
        headers: {
          Accept: "text/html,application/json,*/*",
          "User-Agent": "SaCMS-QA-Auditor/1.0",
        },
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - start);
      const isRedirect = [301, 302, 307, 308].includes(res.status);
      const ok = (res.status >= 200 && res.status < 400) || res.status === 401 || res.status === 403;

      let details = "";
      if (res.status === 200) {
        details = "HTTP 200 OK";
      } else if (isRedirect) {
        const loc = res.headers.get("location") || "";
        details = `HTTP ${res.status} Redirect -> ${loc}`;
      } else if (res.status === 401 || res.status === 403) {
        details = `HTTP ${res.status} (Protected Auth Gate)`;
      } else {
        details = `HTTP ${res.status}`;
      }

      results.push({
        route: item.route,
        name: item.name,
        category: item.category,
        status: res.status,
        ok,
        durationMs: duration,
        details,
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      results.push({
        route: item.route,
        name: item.name,
        category: item.category,
        status: 0,
        ok: false,
        durationMs: duration,
        details: `Connection Error: ${err?.message || "Unknown"}`,
      });
    }
  }

  // Print results table
  console.log("\n==================================================================");
  console.log("📊 QA AUDIT ROUTE-BY-ROUTE RESULTS");
  console.log("==================================================================");

  let passedCount = 0;
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    if (r.ok) passedCount++;
    console.log(
      `${icon} [${r.category.padEnd(16)}] ${r.name.padEnd(38)} | ${r.status.toString().padStart(3)} | ${r.durationMs.toString().padStart(4)}ms | ${r.details}`
    );
  }

  console.log("==================================================================");
  const score = Math.round((passedCount / results.length) * 100);
  console.log(`🎯 QA SCORE: ${passedCount}/${results.length} PASSED (${score}%)`);
  console.log("==================================================================");

  return { passedCount, total: results.length, score, results };
}

if (import.meta.main) {
  runQAAudit()
    .then((summary) => {
      process.exit(summary.passedCount === summary.total ? 0 : 1);
    })
    .catch((e) => {
      console.error("QA Error:", e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
