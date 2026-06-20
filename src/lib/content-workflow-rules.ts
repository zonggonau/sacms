/**
 * Pure content-workflow rules shared by server and client code.
 * Keep this module free of database and framework imports.
 */

export const CONTENT_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED",
] as const

export type WorkflowStatus = (typeof CONTENT_STATUSES)[number]

export const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  DRAFT: ["IN_REVIEW", "PUBLISHED", "SCHEDULED"],
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PUBLISHED", "SCHEDULED"],
  SCHEDULED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["ARCHIVED", "DRAFT"],
  ARCHIVED: ["DRAFT"],
  REJECTED: ["DRAFT"],
}

const TRANSITION_ROLES: Partial<Record<string, string[]>> = {
  "DRAFT->IN_REVIEW": ["owner", "admin", "editor", "member"],
  "DRAFT->PUBLISHED": ["owner", "admin"],
  "DRAFT->SCHEDULED": ["owner", "admin"],
  "IN_REVIEW->APPROVED": ["owner", "admin"],
  "IN_REVIEW->REJECTED": ["owner", "admin"],
  "APPROVED->PUBLISHED": ["owner", "admin"],
  "APPROVED->SCHEDULED": ["owner", "admin"],
  "SCHEDULED->PUBLISHED": ["system"],
  "SCHEDULED->DRAFT": ["owner", "admin"],
  "PUBLISHED->ARCHIVED": ["owner", "admin"],
  "PUBLISHED->DRAFT": ["owner", "admin"],
  "ARCHIVED->DRAFT": ["owner", "admin", "editor"],
  "REJECTED->DRAFT": ["owner", "admin", "editor", "member"],
}

export const TRANSITION_PERMISSIONS: Record<string, string> = {
  "DRAFT->IN_REVIEW": "workflow.draft_to_review",
  "DRAFT->PUBLISHED": "workflow.draft_to_publish",
  "DRAFT->SCHEDULED": "workflow.draft_to_schedule",
  "IN_REVIEW->APPROVED": "workflow.review_to_approve",
  "IN_REVIEW->REJECTED": "workflow.review_to_reject",
  "APPROVED->PUBLISHED": "workflow.approve_to_publish",
  "APPROVED->SCHEDULED": "workflow.approve_to_schedule",
  "SCHEDULED->DRAFT": "workflow.scheduled_to_draft",
  "PUBLISHED->ARCHIVED": "workflow.published_to_archived",
  "PUBLISHED->DRAFT": "workflow.published_to_draft",
  "ARCHIVED->DRAFT": "workflow.archived_to_draft",
  "REJECTED->DRAFT": "workflow.rejected_to_draft",
}

export function isWorkflowStatus(value: string): value is WorkflowStatus {
  return CONTENT_STATUSES.includes(value as WorkflowStatus)
}

export function canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  return WORKFLOW_TRANSITIONS[from].includes(to)
}

export function allowedTransitions(from: WorkflowStatus): WorkflowStatus[] {
  return WORKFLOW_TRANSITIONS[from]
}

export function canUserTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
  role: string,
  customPermissions?: string[] | null
): boolean {
  if (!canTransition(from, to)) return false
  if (role === "owner" || role === "admin") return true

  const key = `${from}->${to}`
  if (Array.isArray(customPermissions)) {
    const requiredPermission = TRANSITION_PERMISSIONS[key]
    return Boolean(requiredPermission && customPermissions.includes(requiredPermission))
  }

  return TRANSITION_ROLES[key]?.includes(role) ?? false
}

export function allowedUserTransitions(
  from: WorkflowStatus,
  role: string,
  customPermissions?: string[] | null
): WorkflowStatus[] {
  return allowedTransitions(from).filter((to) =>
    canUserTransition(from, to, role, customPermissions)
  )
}

export function allowedInitialStatuses(
  role: string,
  customPermissions?: string[] | null
): WorkflowStatus[] {
  return [
    "DRAFT",
    ...allowedUserTransitions("DRAFT", role, customPermissions),
  ]
}
