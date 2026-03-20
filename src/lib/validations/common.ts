import { z } from "zod/v4"

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

// Sort
export const sortSchema = z
  .string()
  .regex(/^[a-zA-Z_]+:(asc|desc)$/, "Sort format: field:asc or field:desc")
  .default("createdAt:desc")

// Locale
export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Locale format: en, id, en-US")
  .default("en")

// CUID
export const cuidSchema = z.string().min(1, "ID is required")

// Slug
export const slugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with dashes")

// Content status values
export const contentStatusValues = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
  "REJECTED",
] as const

export const contentStatusSchema = z.enum(contentStatusValues)
