export function studioModelWhere(tenantId: string) {
  return {
    draftTemplateId: null,
    showInCms: true,
    OR: [
      { tenantId },
      { tenantId: null, tenants: { some: { tenantId, enabled: true } } },
    ],
  }
}
