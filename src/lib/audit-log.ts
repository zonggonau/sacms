import { db } from "@/lib/database"

export interface AuditLogParams {
  tenantId?: string
  userId?: string
  action: string
  entity: string
  entityId?: string
  data?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Write an audit log entry. Fire-and-forget — never blocks the caller.
 */
export function logAudit(params: AuditLogParams): void {
  db.auditLog
    .create({
      data: {
        tenantId: params.tenantId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        data: params.data ? JSON.stringify(params.data) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
    .catch((err) => {
      console.error("Failed to write audit log:", err)
    })
}

/** Standard audit actions */
export const AuditAction = {
  // Auth
  LOGIN: "auth.login",
  REGISTER: "auth.register",
  LOGOUT: "auth.logout",

  // Content
  CONTENT_CREATED: "content.created",
  CONTENT_UPDATED: "content.updated",
  CONTENT_DELETED: "content.deleted",
  CONTENT_PUBLISHED: "content.published",
  CONTENT_UNPUBLISHED: "content.unpublished",
  CONTENT_VERSION_RESTORED: "content.version_restored",

  // Single Types
  SINGLE_TYPE_UPDATED: "single_type.updated",

  // Media
  MEDIA_UPLOADED: "media.uploaded",
  MEDIA_DELETED: "media.deleted",

  // Tenant
  TENANT_CREATED: "tenant.created",
  TENANT_UPDATED: "tenant.updated",
  MEMBER_ADDED: "tenant.member_added",
  MEMBER_REMOVED: "tenant.member_removed",
  MEMBER_ROLE_CHANGED: "tenant.member_role_changed",

  // API Tokens
  TOKEN_CREATED: "api_token.created",
  TOKEN_DELETED: "api_token.deleted",

  // Webhooks
  WEBHOOK_CREATED: "webhook.created",
  WEBHOOK_UPDATED: "webhook.updated",
  WEBHOOK_DELETED: "webhook.deleted",

  // Settings
  SETTINGS_UPDATED: "settings.updated",
} as const
