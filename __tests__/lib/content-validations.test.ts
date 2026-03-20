import { describe, it, expect } from "vitest"
import {
  createEntrySchema,
  updateEntrySchema,
  changeStatusSchema,
  bulkDeleteSchema,
} from "@/lib/validations/content"
import {
  isAllowedMimeType,
  isAllowedFileSize,
  MIME_WHITELIST,
  MAX_FILE_SIZE,
  mediaUploadSchema,
} from "@/lib/validations/media"
import {
  createWebhookSchema,
} from "@/lib/validations/webhook"
import {
  createApiTokenSchema,
} from "@/lib/validations/api-token"

describe("Content Validations", () => {
  describe("createEntrySchema", () => {
    it("accepts valid entry with defaults", () => {
      const result = createEntrySchema.safeParse({
        data: { title: "Hello", body: "World" },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe("DRAFT")
        expect(result.data.locale).toBe("en")
      }
    })

    it("accepts entry with explicit status", () => {
      const result = createEntrySchema.safeParse({
        data: { title: "Hello" },
        status: "PUBLISHED",
        locale: "id",
      })
      expect(result.success).toBe(true)
    })

    it("accepts entry with scheduled date", () => {
      const result = createEntrySchema.safeParse({
        data: { title: "Scheduled" },
        scheduledAt: "2026-04-01T00:00:00Z",
      })
      expect(result.success).toBe(true)
    })

    it("rejects invalid status", () => {
      const result = createEntrySchema.safeParse({
        data: {},
        status: "INVALID_STATUS",
      })
      expect(result.success).toBe(false)
    })

    it("rejects missing data", () => {
      const result = createEntrySchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe("updateEntrySchema", () => {
    it("accepts partial update", () => {
      const result = updateEntrySchema.safeParse({
        data: { title: "Updated" },
      })
      expect(result.success).toBe(true)
    })

    it("accepts status-only update", () => {
      const result = updateEntrySchema.safeParse({
        status: "IN_REVIEW",
      })
      expect(result.success).toBe(true)
    })

    it("accepts empty update", () => {
      const result = updateEntrySchema.safeParse({})
      expect(result.success).toBe(true)
    })
  })

  describe("changeStatusSchema", () => {
    it("accepts valid status change", () => {
      const result = changeStatusSchema.safeParse({ status: "PUBLISHED" })
      expect(result.success).toBe(true)
    })

    it("accepts status with comment", () => {
      const result = changeStatusSchema.safeParse({
        status: "REJECTED",
        comment: "Needs more detail",
      })
      expect(result.success).toBe(true)
    })

    it("rejects missing status", () => {
      const result = changeStatusSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe("bulkDeleteSchema", () => {
    it("accepts valid array of IDs", () => {
      const result = bulkDeleteSchema.safeParse({
        ids: ["cm1234567890abcdef12345"],
      })
      expect(result.success).toBe(true)
    })

    it("rejects empty array", () => {
      const result = bulkDeleteSchema.safeParse({ ids: [] })
      expect(result.success).toBe(false)
    })
  })
})

describe("Media Validations", () => {
  describe("isAllowedMimeType", () => {
    it("allows jpeg images", () => {
      expect(isAllowedMimeType("image/jpeg")).toBe(true)
    })

    it("allows png images", () => {
      expect(isAllowedMimeType("image/png")).toBe(true)
    })

    it("allows webp images", () => {
      expect(isAllowedMimeType("image/webp")).toBe(true)
    })

    it("allows pdf documents", () => {
      expect(isAllowedMimeType("application/pdf")).toBe(true)
    })

    it("allows mp4 video", () => {
      expect(isAllowedMimeType("video/mp4")).toBe(true)
    })

    it("rejects executable files", () => {
      expect(isAllowedMimeType("application/x-executable")).toBe(false)
    })

    it("rejects zip files", () => {
      expect(isAllowedMimeType("application/zip")).toBe(false)
    })

    it("rejects javascript", () => {
      expect(isAllowedMimeType("application/javascript")).toBe(false)
    })

    it("rejects html", () => {
      expect(isAllowedMimeType("text/html")).toBe(false)
    })
  })

  describe("isAllowedFileSize", () => {
    it("allows 1 byte file", () => {
      expect(isAllowedFileSize(1)).toBe(true)
    })

    it("allows 10MB file (exact limit)", () => {
      expect(isAllowedFileSize(MAX_FILE_SIZE)).toBe(true)
    })

    it("rejects 0 byte file", () => {
      expect(isAllowedFileSize(0)).toBe(false)
    })

    it("rejects file over 10MB", () => {
      expect(isAllowedFileSize(MAX_FILE_SIZE + 1)).toBe(false)
    })

    it("rejects negative size", () => {
      expect(isAllowedFileSize(-1)).toBe(false)
    })
  })

  describe("mediaUploadSchema", () => {
    it("accepts empty body", () => {
      const result = mediaUploadSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    it("accepts alt and caption", () => {
      const result = mediaUploadSchema.safeParse({
        alt: "A photo",
        caption: "Taken in 2026",
      })
      expect(result.success).toBe(true)
    })
  })
})

describe("Webhook Validations", () => {
  it("accepts valid webhook", () => {
    const result = createWebhookSchema.safeParse({
      name: "My Webhook",
      url: "https://example.com/webhook",
      events: ["afterCreate", "afterUpdate"],
    })
    expect(result.success).toBe(true)
  })
})

describe("API Token Validations", () => {
  it("accepts valid token creation", () => {
    const result = createApiTokenSchema.safeParse({
      name: "My Token",
      type: "read-only",
    })
    expect(result.success).toBe(true)
  })
})
