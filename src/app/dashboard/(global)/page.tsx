import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/database"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { WorkspaceManager } from "@/components/dashboard/workspace-manager"

const SYSTEM_SLUGS = ["sacms-global"]

export default async function WorkspaceSelectionPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect("/login")

  const tenants = await db.tenant.findMany({
    where: {
      members: { some: { userId: session.user.id } },
      slug: { notIn: SYSTEM_SLUGS },
    },
    include: {
      members: {
        where: { userId: session.user.id },
        select: { role: true }
      },
      subscriptions: {
        where: { status: { in: ["active", "trialing"] } },
        orderBy: { currentPeriodEnd: "desc" },
        take: 1
      }
    },
    orderBy: { createdAt: "desc" }
  })

  const formattedTenants = tenants.map(t => {
    const sub = t.subscriptions[0]
    let daysRemaining = null
    
    if (sub?.currentPeriodEnd) {
      const diff = new Date(sub.currentPeriodEnd).getTime() - Date.now()
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      plan: t.plan,
      createdAt: t.createdAt.toISOString(),
      role: t.members[0]?.role || 'member',
      daysRemaining,
      expiresAt: sub?.currentPeriodEnd?.toISOString() || null,
      subscriptionStatus: sub?.status || null
    }
  })

  const { enforceUserPlanLimit } = await import("@/lib/plan-enforcement")
  const workspaceEnforcement = await enforceUserPlanLimit(session.user.id, "workspaces")
  const usage = {
    current: workspaceEnforcement.current,
    max: workspaceEnforcement.max,
    allowed: workspaceEnforcement.allowed,
    plan: workspaceEnforcement.planSlug
  }

  const headersList = await headers();
  const host = headersList.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;
  const globalToken = process.env.NEXT_PUBLIC_SYSTEM_API_KEY || "internal";
  
  // Because fetching from localhost in RSC can sometimes stall if Node limits concurrent connections, 
  // it is generally safe but let's wrap in Promise.all for speed.
  const fetchOpts = { next: { revalidate: 3600 }, headers: { Authorization: `Bearer ${globalToken}` } };

  let dbTemplates = [];
  let workspacePlans = [
    { id: "free", name: "Free", price: "Rp 0", priceAmount: 0, yearlyPrice: 0, desc: "For small personal projects", features: ["Unlimited Content Types", "500 Entries"] }
  ];
  let addonPlans = [];

  try {
    const [templatesRes, plansRes, addonsRes] = await Promise.all([
      fetch(`${baseUrl}/api/public/content/templates`, fetchOpts).catch(() => null),
      fetch(`${baseUrl}/api/public/sacms-global/content/sacms-workspace-pricing?sort=price:asc`, fetchOpts).catch(() => null),
      fetch(`${baseUrl}/api/public/sacms-global/content/sacms-addons?sort=price:asc`, fetchOpts).catch(() => null)
    ]);

    if (templatesRes?.ok) {
      const json = await templatesRes.json();
      dbTemplates = json.data || [];
    }

    if (plansRes?.ok) {
      const json = await plansRes.json();
      if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        workspacePlans = json.data.map((p: any) => ({
          id: p.plan_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          name: p.name,
          price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
          priceAmount: p.price,
          yearlyPrice: p.yearly_price !== undefined ? p.yearly_price : p.price * 10,
          desc: p.description || "",
          features: p.features || []
        }));
      }
    }

    if (addonsRes?.ok) {
      const json = await addonsRes.json();
      if (json.data && Array.isArray(json.data)) {
        addonPlans = json.data.map((p: any) => ({
          id: p.addon_slug || p.name.toLowerCase().replace(/\s+/g, '-'),
          name: p.name,
          price: `Rp ${(p.price / 1000).toLocaleString('id-ID')}k`,
          priceAmount: p.price,
          desc: p.description || "",
          icon: p.icon || "Zap"
        }));
      }
    }
  } catch (e) {
    console.error("Failed to fetch global dependencies in RSC:", e);
  }

  return (
    <WorkspaceManager 
      initialTenants={formattedTenants}
      usage={usage}
      dbTemplates={dbTemplates}
      workspacePlans={workspacePlans}
      addonPlans={addonPlans}
      isSuperAdmin={session.user.role === "super_admin"}
    />
  )
}
