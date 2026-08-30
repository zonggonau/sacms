import { z } from "zod/v4"

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream"
] as const

export const MIME_WHITELIST = new Set<string>(ALLOWED_MIME_TYPES)

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export const mediaUploadSchema = z.object({
  folderId: z.string().optional(),
  alt: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
})

export const mediaUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  alt: z.string().max(500).optional(),
  caption: z.string().max(1000).optional(),
  folderId: z.string().nullable().optional(),
})

/**
 * Basic buffer signature (magic bytes) validation.
 * For more complex types, consider using the 'file-type' package.
 */
export function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (!buffer || buffer.length < 4) return false

  const header = buffer.subarray(0, 32)
  const hex = header.toString("hex").toUpperCase()

  switch (mimeType) {
    case "image/jpeg":
      return hex.startsWith("FFD8FF")
    case "image/png":
      return hex.startsWith("89504E47")
    case "image/gif":
      return hex.startsWith("47494638")
    case "image/webp":
      // WebP: RIFF (bytes 0-3 = 52494646) + 4-byte size + WEBP (bytes 8-11 = 57454250)
      return buffer.length >= 12 && hex.startsWith("52494646") && hex.substring(16, 24) === "57454250"
    case "image/avif":
      // AVIF: ftypavif in bytes 4-11
      return hex.substring(8, 24).includes("66747970")
    case "video/mp4":
    case "video/quicktime":
      // MP4/MOV: bytes 4-7 = ftyp (66747970) or moov (6D6F6F76)
      return hex.substring(8, 16) === "66747970" || hex.substring(8, 16) === "6D6F6F76" || hex.startsWith("000000")
    case "video/webm":
      // WebM: EBML header 1A 45 DF A3
      return hex.startsWith("1A45DFA3")
    case "application/pdf":
      return hex.startsWith("25504446")
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/zip":
    case "application/x-zip-compressed":
      return hex.startsWith("504B")
    case "application/msword":
      return hex.startsWith("D0CF11E0") || hex.startsWith("504B")
    case "image/svg+xml":
      // Basic SVG check: starts with <svg or <?xml
      const svgStart = buffer.subarray(0, 100).toString().toLowerCase()
      return svgStart.includes("<svg") || svgStart.includes("<?xml")
    default:
      return true
  }
}

/**
 * Validate file MIME type against whitelist
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return MIME_WHITELIST.has(mimeType)
}

/**
 * Validate file size
 */
export function isAllowedFileSize(size: number): boolean {
  return size > 0 && size <= MAX_FILE_SIZE
}
