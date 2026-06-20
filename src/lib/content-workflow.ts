import { db } from "@/lib/database"
import type { ContentStatus } from "@prisma/client"
import type { PrismaClient } from "../../prisma/generated-client"
import {
  allowedTransitions as allowedWorkflowTransitions,
  canTransition as canWorkflowTransition,
  canUserTransition as canWorkflowUserTransition,
  TRANSITION_PERMISSIONS,
  type WorkflowStatus,
} from "@/lib/content-workflow-rules"

export { TRANSITION_PERMISSIONS }

/**
 * Content workflow state machine.
 * Defines valid transitions between content statuses.
 *
 * Flow:
 *   DRAFT → IN_REVIEW → APPROVED → PUBLISHED
 *            ↓            ↓
 *         REJECTED     SCHEDULED → PUBLISHED (via cron)
 *            ↓
 *          DRAFT
 *   DRAFT → PUBLISHED | SCHEDULED (owner/admin direct path)
 *   PUBLISHED → ARCHIVED
 *   ARCHIVED → DRAFT (restore)
 *
 * Multi-reviewer decisions are processed in sequence order. Owner/admin retain
 * the explicit workflow permission to override IN_REVIEW through the status action.
 */

/**
 * Check if a status transition is valid.
 */
export function canTransition(
  from: ContentStatus,
  to: ContentStatus
): boolean {
  return canWorkflowTransition(from as WorkflowStatus, to as WorkflowStatus)
}

/**
 * Get allowed next statuses from the current status.
 */
export function allowedTransitions(from: ContentStatus): ContentStatus[] {
  return allowedWorkflowTransitions(from as WorkflowStatus) as ContentStatus[]
}

/**
 * Check if a user can perform a specific transition based on role and custom permissions.
 */
export function canUserTransition(
  from: ContentStatus,
  to: ContentStatus,
  role: string,
  customPermissions?: string[] | null
): boolean {
  return canWorkflowUserTransition(
    from as WorkflowStatus,
    to as WorkflowStatus,
    role,
    customPermissions
  )
}

/**
 * Legacy wrapper for backward compatibility
 */
export function canRoleTransition(
  from: ContentStatus,
  to: ContentStatus,
  role: string
): boolean {
  return canUserTransition(from, to, role)
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
  assignedBy: string,
  client: PrismaClient = db
): Promise<void> {
  // Remove existing assignments
  await client.contentReviewAssignment.deleteMany({
    where: { contentEntryId },
  })

  // Create new assignments in order
  await client.contentReviewAssignment.createMany({
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
  contentEntryId: string,
  client: PrismaClient = db
): Promise<{ reviewerId: string; order: number } | null> {
  const assignment = await client.contentReviewAssignment.findFirst({
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
  comment?: string,
  client: PrismaClient = db
): Promise<{ allApproved: boolean; rejected: boolean }> {
  // Get this reviewer's assignment
  const assignment = await client.contentReviewAssignment.findUnique({
    where: {
      contentEntryId_reviewerId: { contentEntryId, reviewerId },
    },
  })

  if (!assignment || assignment.status !== "pending") {
    throw new Error("No pending review assignment for this user")
  }

  // Check this is the current reviewer in sequence
  const current = await getCurrentReviewer(contentEntryId, client)
  if (!current || current.reviewerId !== reviewerId) {
    throw new Error("It is not your turn to review")
  }

  // Conditional update prevents duplicate decisions from racing each other.
  const updated = await client.contentReviewAssignment.updateMany({
    where: { id: assignment.id, status: "pending" },
    data: {
      status: decision,
      comment: comment || null,
      reviewedAt: new Date(),
    },
  })

  if (updated.count !== 1) {
    throw new Error("This review assignment has already been decided")
  }

  if (decision === "rejected") {
    return { allApproved: false, rejected: true }
  }

  // Check if all reviewers have approved
  const remaining = await client.contentReviewAssignment.count({
    where: { contentEntryId, status: "pending" },
  })

  return { allApproved: remaining === 0, rejected: false }
}

/**
 * Get all review assignments for a content entry.
 */
export async function getReviewAssignments(contentEntryId: string, client: PrismaClient = db) {
  return client.contentReviewAssignment.findMany({
    where: { contentEntryId },
    orderBy: { order: "asc" },
  })
}

/**
 * Check if user is the current/active reviewer for an entry.
 */
export async function isCurrentReviewer(
  contentEntryId: string,
  userId: string,
  client: PrismaClient = db
): Promise<boolean> {
  const current = await getCurrentReviewer(contentEntryId, client)
  return current?.reviewerId === userId
}
