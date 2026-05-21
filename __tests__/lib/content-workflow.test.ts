import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  canTransition,
  allowedTransitions,
  canRoleTransition,
  getStatusDisplay,
  assignReviewers,
  getCurrentReviewer,
  submitReview,
  getReviewAssignments,
  isCurrentReviewer,
} from "../../src/lib/content-workflow"
import { db } from "../../src/lib/database"

vi.mock("../../src/lib/database", () => ({
  db: {
    contentReviewAssignment: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

describe("Content Workflow", () => {
  describe("State Machine", () => {
    it("returns correct allowed transitions for DRAFT", () => {
      const allowed = allowedTransitions("DRAFT")
      expect(allowed).toContain("IN_REVIEW")
      expect(allowed).toContain("PUBLISHED")
      expect(allowed).not.toContain("SCHEDULED")
    })

    it("evaluates valid transitions correctly", () => {
      expect(canTransition("DRAFT", "IN_REVIEW")).toBe(true)
      expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true)
      expect(canTransition("APPROVED", "PUBLISHED")).toBe(true)
      
      // Invalid transitions
      expect(canTransition("DRAFT", "ARCHIVED")).toBe(false)
      expect(canTransition("PUBLISHED", "APPROVED")).toBe(false)
      expect(canTransition("REJECTED", "PUBLISHED")).toBe(false)
    })
  })

  describe("Role-based Transitions", () => {
    it("allows admin to perform most transitions", () => {
      expect(canRoleTransition("DRAFT", "IN_REVIEW", "admin")).toBe(true)
      expect(canRoleTransition("IN_REVIEW", "APPROVED", "admin")).toBe(true)
      expect(canRoleTransition("APPROVED", "PUBLISHED", "admin")).toBe(true)
    })

    it("restricts editor actions correctly", () => {
      // Editor can draft to review
      expect(canRoleTransition("DRAFT", "IN_REVIEW", "editor")).toBe(true)
      // Editor cannot approve
      expect(canRoleTransition("IN_REVIEW", "APPROVED", "editor")).toBe(false)
      // Editor cannot publish
      expect(canRoleTransition("APPROVED", "PUBLISHED", "editor")).toBe(false)
    })

    it("restricts member actions correctly", () => {
      expect(canRoleTransition("DRAFT", "IN_REVIEW", "member")).toBe(true)
      expect(canRoleTransition("REJECTED", "DRAFT", "member")).toBe(true)
      expect(canRoleTransition("IN_REVIEW", "APPROVED", "member")).toBe(false)
    })
    
    it("returns false for invalid transitions even with correct role", () => {
      // Admin cannot go DRAFT -> APPROVED directly
      expect(canRoleTransition("DRAFT", "APPROVED", "admin")).toBe(false)
    })
  })

  describe("getStatusDisplay", () => {
    it("returns correct label and color for all statuses", () => {
      expect(getStatusDisplay("DRAFT")).toEqual({ label: "Draft", color: "gray" })
      expect(getStatusDisplay("PUBLISHED")).toEqual({ label: "Published", color: "green" })
      expect(getStatusDisplay("IN_REVIEW")).toEqual({ label: "In Review", color: "yellow" })
    })
  })

  describe("Multi-Reviewer System", () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it("assigns reviewers in order", async () => {
      await assignReviewers("entry-1", [{ userId: "u1" }, { userId: "u2" }], "admin")
      
      expect(db.contentReviewAssignment.deleteMany).toHaveBeenCalledWith({
        where: { contentEntryId: "entry-1" },
      })
      expect(db.contentReviewAssignment.createMany).toHaveBeenCalledWith({
        data: [
          {
            contentEntryId: "entry-1",
            reviewerId: "u1",
            reviewerName: null,
            order: 0,
            status: "pending",
            assignedBy: "admin",
          },
          {
            contentEntryId: "entry-1",
            reviewerId: "u2",
            reviewerName: null,
            order: 1,
            status: "pending",
            assignedBy: "admin",
          },
        ],
      })
    })

    it("gets the current pending reviewer", async () => {
      vi.mocked(db.contentReviewAssignment.findFirst).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u1",
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const current = await getCurrentReviewer("entry-1")
      
      expect(db.contentReviewAssignment.findFirst).toHaveBeenCalledWith({
        where: { contentEntryId: "entry-1", status: "pending" },
        orderBy: { order: "asc" },
      })
      expect(current).toEqual({ reviewerId: "u1", order: 0 })
    })

    it("throws if submitting review out of turn", async () => {
      vi.mocked(db.contentReviewAssignment.findUnique).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u2",
        order: 1,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      vi.mocked(db.contentReviewAssignment.findFirst).mockResolvedValueOnce({
        id: "a0",
        reviewerId: "u1", // u1 is current, not u2
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      await expect(submitReview("entry-1", "u2", "approved")).rejects.toThrow("It is not your turn to review")
    })

    it("successfully submits review and detects full approval", async () => {
      vi.mocked(db.contentReviewAssignment.findUnique).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u1",
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      vi.mocked(db.contentReviewAssignment.findFirst).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u1",
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      vi.mocked(db.contentReviewAssignment.count).mockResolvedValueOnce(0) // No remaining pending

      const result = await submitReview("entry-1", "u1", "approved", "Looks good")
      
      expect(db.contentReviewAssignment.update).toHaveBeenCalledWith({
        where: { id: "a1" },
        data: expect.objectContaining({
          status: "approved",
          comment: "Looks good",
          reviewedAt: expect.any(Date)
        }),
      })
      
      expect(result).toEqual({ allApproved: true, rejected: false })
    })
    
    it("handles rejection correctly", async () => {
      vi.mocked(db.contentReviewAssignment.findUnique).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u1",
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      vi.mocked(db.contentReviewAssignment.findFirst).mockResolvedValueOnce({
        id: "a1",
        reviewerId: "u1",
        order: 0,
        contentEntryId: "entry-1",
        status: "pending",
        reviewerName: null,
        assignedBy: "admin",
        comment: null,
        reviewedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await submitReview("entry-1", "u1", "rejected")
      
      expect(result).toEqual({ allApproved: false, rejected: true })
      // Count should not be called if rejected
      expect(db.contentReviewAssignment.count).not.toHaveBeenCalled()
    })
  })
})
