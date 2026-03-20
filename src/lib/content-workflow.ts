import type { ContentStatus } from "@prisma/client"
import { db } from "@/lib/database"

/**
 * Content workflow state machine.
 * Defines valid transitions between content statuses.
 *
 * Flow:
 *   DRAFT → IN_REVIEW → APPROVED → PUBLISHED
 *                     → REJECTED → DRAFT (re-edit)
 *                     → SCHEDULED → PUBLISHED (via cron)
 *   PUBLISHED → ARCHIVED
 *   ARCHIVED → DRAFT (restore)
 *
 * Multi-reviewer: When reviewers are assigned, IN_REVIEW → APPROVED
 * requires all reviewers to approve in sequence order.
 */

const TRANSITIONS: Record<ContentStatus, ContentStatus[]> = {
  DRAFT: ["IN_REVIEW", "PUBLISHED"], // direct publish for admins
  IN_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PUBLISHED", "SCHEDULED"],
  SCHEDULED: ["PUBLISHED", "DRAFT"], // cancel schedule reverts to draft
  PUBLISHED: ["ARCHIVED", "DRAFT"], // unpublish
  ARCHIVED: ["DRAFT"], // restore
  REJECTED: ["DRAFT"], // re-edit
}

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: ContentStatus,
  to: ContentStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Get allowed next statuses from the current status.
 */
export function allowedTransitions(from: ContentStatus): ContentStatus[] {
  return TRANSITIONS[from] ?? []
}

/**
 * Roles that can perform specific transitions.
 */
const TRANSITION_ROLES: Partial<
  Record<string, string[]>
> = {
  "DRAFT->IN_REVIEW": ["owner", "admin", "editor", "member"],
  "IN_REVIEW->APPROVED": ["owner", "admin"],
  "IN_REVIEW->REJECTED": ["owner", "admin"],
  "APPROVED->PUBLISHED": ["owner", "admin"],
  "APPROVED->SCHEDULED": ["owner", "admin"],
  "PUBLISHED->ARCHIVED": ["owner", "admin"],
  "PUBLISHED->DRAFT": ["owner", "admin"],
  "ARCHIVED->DRAFT": ["owner", "admin", "editor"],
  "REJECTED->DRAFT": ["owner", "admin", "editor", "member"],
  "SCHEDULED->PUBLISHED": ["system"], // cron only
  "SCHEDULED->DRAFT": ["owner", "admin"],
  "DRAFT->PUBLISHED": ["owner", "admin"], // direct publish
}

/**
 * Check if a role can perform a specific transition.
 */
export function canRoleTransition(
  from: ContentStatus,
  to: ContentStatus,
  role: string
): boolean {
  if (!canTransition(from, to)) return false
  const key = `${from}->${to}`
  const allowed = TRANSITION_ROLES[key]
  if (!allowed) return false
  return allowed.includes(role)
}

/**
 * Get display label and color for a content status.
 */
export function getStatusDisplay(status: ContentStatus): {
  label: string
  color: string
} {
  const map: Record<ContentStatus, { label: string; color: string }> = {
    DRAFT: { label: "Draft", color: "gray" },
    IN_REVIEW: { label: "In Review", color: "yellow" },
    APPROVED: { label: "Approved", color: "blue" },
    SCHEDULED: { label: "Scheduled", color: "purple" },
    PUBLISHED: { label: "Published", color: "green" },
    ARCHIVED: { label: "Archived", color: "slate" },
    REJECTED: { label: "Rejected", color: "red" },
  }
  return map[status]
}

// ==================== MULTI-REVIEWER SYSTEM ====================

/**
 * Assign reviewers to a content entry.
 * Reviewers are processed in order (0, 1, 2...).
 */
export async function assignReviewers(
  contentEntryId: string,
  reviewers: Array<{ userId: string; name?: string }>,
  assignedBy: string
): Promise<void> {
  // Remove existing assignments
  await db.contentReviewAssignment.deleteMany({
    where: { contentEntryId },
  })

  // Create new assignments in order
  await db.contentReviewAssignment.createMany({
    data: reviewers.map((r, index) => ({
      contentEntryId,
      reviewerId: r.userId,
      reviewerName: r.name || null,
      order: index,
      status: "pending",
      assignedBy,
    })),
  })
}

/**
 * Get the current reviewer (next pending in sequence).
 */
export async function getCurrentReviewer(
  contentEntryId: string
): Promise<{ reviewerId: string; order: number } | null> {
  const assignment = await db.contentReviewAssignment.findFirst({
    where: { contentEntryId, status: "pending" },
    orderBy: { order: "asc" },
  })
  return assignment
    ? { reviewerId: assignment.reviewerId, order: assignment.order }
    : null
}

/**
 * Submit a review decision for the current reviewer in the chain.
 * Returns whether all reviewers have approved (entry can be auto-approved).
 */
export async function submitReview(
  contentEntryId: string,
  reviewerId: string,
  decision: "approved" | "rejected",
  comment?: string
): Promise<{ allApproved: boolean; rejected: boolean }> {
  // Get this reviewer's assignment
  const assignment = await db.contentReviewAssignment.findUnique({
    where: {
      contentEntryId_reviewerId: { contentEntryId, reviewerId },
    },
  })

  if (!assignment || assignment.status !== "pending") {
    throw new Error("No pending review assignment for this user")
  }

  // Check this is the current reviewer in sequence
  const current = await getCurrentReviewer(contentEntryId)
  if (!current || current.reviewerId !== reviewerId) {
    throw new Error("It is not your turn to review")
  }

  // Update this assignment
  await db.contentReviewAssignment.update({
    where: { id: assignment.id },
    data: {
      status: decision,
      comment: comment || null,
      reviewedAt: new Date(),
    },
  })

  if (decision === "rejected") {
    return { allApproved: false, rejected: true }
  }

  // Check if all reviewers have approved
  const remaining = await db.contentReviewAssignment.count({
    where: { contentEntryId, status: "pending" },
  })

  return { allApproved: remaining === 0, rejected: false }
}

/**
 * Get all review assignments for a content entry.
 */
export async function getReviewAssignments(contentEntryId: string) {
  return db.contentReviewAssignment.findMany({
    where: { contentEntryId },
    orderBy: { order: "asc" },
  })
}

/**
 * Check if user is the current/active reviewer for an entry.
 */
export async function isCurrentReviewer(
  contentEntryId: string,
  userId: string
): Promise<boolean> {
  const current = await getCurrentReviewer(contentEntryId)
  return current?.reviewerId === userId
}
