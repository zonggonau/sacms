export function studioModelWhere(tenantId: string, isGlobal: boolean) {
  return {
    draftTemplateId: null,
    showInCms: true,
    OR: [
      { tenantId },
      { tenantId: null, tenants: { some: { tenantId, enabled: true } } },
      ...(isGlobal ? [{ tenantId: null }] : []),
    ],
  }
}
