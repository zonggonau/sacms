const fs = require('fs');

const globalImport = `const { getGlobalWorkspaceId } = await import("@/lib/settings");\n    const globalId = await getGlobalWorkspaceId();\n    `;
const globalImportTopLevel = `const { getGlobalWorkspaceId } = await import("@/lib/settings");\n  const globalId = await getGlobalWorkspaceId();\n  `;

function replaceInFile(file, replacements) {
  let content = fs.readFileSync(file, 'utf8');
  for (const r of replacements) {
    content = content.replace(r.from, r.to);
  }
  fs.writeFileSync(file, content);
}

// 1. license/activate/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/license/activate/route.ts', [
  { from: 'if (tenantId !== "sacms-global") {', to: globalImportTopLevel + 'if (tenantId !== globalId) {' }
]);

// 2. settings/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/settings/route.ts', [
  { from: 'let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)', to: globalImport + 'let isEnterprise = await isEnterpriseTenant(globalId, session.user.id)' },
  { from: 'let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)', to: globalImport + 'let isEnterprise = await isEnterpriseTenant(globalId, session.user.id)' } // there are 2 occurrences
]);

// 3. infrastructure/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/tenant/[tenant]/infrastructure/route.ts', [
  { from: 'let isEnterprise = await isEnterpriseTenant("sacms-global", session.user.id)', to: globalImport + 'let isEnterprise = await isEnterpriseTenant(globalId, session.user.id)' }
]);

// 4. auth/user/plan/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/auth/user/plan/route.ts', [
  { from: 'tenant: { slug: { notIn: ["sacms-global"] } },', to: 'tenantId: { notIn: [await (await import("@/lib/settings")).getGlobalWorkspaceId()] },' }
]);

// 5. dashboard/(global)/page.tsx
replaceInFile('d:/projek/z.ai/sacms/src/app/(workspace)/dashboard/(global)/page.tsx', [
  { from: 'const SYSTEM_SLUGS = ["sacms-global"]', to: 'const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();\n  const SYSTEM_SLUGS = [globalId]' },
  { from: '{ slug: "sacms-global" }', to: '{ id: globalId }' },
  { from: 'let isGlobalEnterprise = await isEnterpriseTenant("sacms-global")', to: 'let isGlobalEnterprise = await isEnterpriseTenant(globalId)' },
  { from: 't.slug === "sacms-global"', to: 't.id === globalId' }
]);

// 6. single-types/page.tsx
replaceInFile('d:/projek/z.ai/sacms/src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/single-types/page.tsx', [
  { from: 'isGlobalTenant={access?.tenant.slug === "sacms-global"}', to: 'isGlobalTenant={access?.isGlobal}' }
]);

// 7. content-types/page.tsx
replaceInFile('d:/projek/z.ai/sacms/src/app/(workspace)/dashboard/[tenant]/(dashboard)/content-type-builder/content-types/page.tsx', [
  { from: 'isGlobalTenant={access?.tenant.slug === "sacms-global"}', to: 'isGlobalTenant={access?.isGlobal}' }
]);

// 8. admin/stats/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/admin/stats/route.ts', [
  { from: 'const SYSTEM_SLUGS = ["sacms-global"]', to: 'const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();\n    const SYSTEM_SLUGS = [globalId]' }
]);

// 9. dashboard/(global)/billing/page.tsx
replaceInFile('d:/projek/z.ai/sacms/src/app/(workspace)/dashboard/(global)/billing/page.tsx', [
  { from: 'slug: { notIn: ["sacms-global"] }', to: 'id: { notIn: [await (await import("@/lib/settings")).getGlobalWorkspaceId()] }' }
]);

// 10. ai/generate-system/route.ts
replaceInFile('d:/projek/z.ai/sacms/src/app/api/admin/ai/generate-system/route.ts', [
  { from: 'where: { OR: [{ slug: "sacms-global" }, { slug: "system" }] }', to: 'where: { OR: [{ id: await (await import("@/lib/settings")).getGlobalWorkspaceId() }, { slug: "system" }] }' }
]);

// 11. admin/settings/page.tsx
replaceInFile('d:/projek/z.ai/sacms/src/app/(system)/admin/settings/page.tsx', [
  { from: 'value={settings.globalTenantId || "sacms-global"}', to: 'value={settings.globalTenantId}' },
  { from: 'const val = settings.globalTenantId || "sacms-global";', to: 'const val = settings.globalTenantId;' }
]);

// 12. tenant-plan.ts
replaceInFile('d:/projek/z.ai/sacms/src/lib/tenant-plan.ts', [
  { from: 'const globalTenant = await db.tenant.findUnique({ where: { slug: "sacms-global" } })', to: 'const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();\n    const globalTenant = await db.tenant.findUnique({ where: { id: globalId } })' },
  { from: 'let isEnterprise = await isEnterpriseTenant("sacms-global")', to: 'const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();\n  let isEnterprise = await isEnterpriseTenant(globalId)' },
  { from: 'const globalTenant = await db.tenant.findUnique({ where: { slug: "sacms-global" } })', to: 'const globalId = await (await import("@/lib/settings")).getGlobalWorkspaceId();\n    const globalTenant = await db.tenant.findUnique({ where: { id: globalId } })' }
]);

console.log("All fixes applied");
