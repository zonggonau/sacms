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
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "application/pdf",
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
  // Common magic bytes:
  // JPEG: FF D8 FF
  // PNG: 89 50 4E 47
  // GIF: 47 49 46 38
  // WebP: 52 49 46 46 (RIFF) + 57 45 42 50 (WEBP)
  // PDF: 25 50 44 46 (%PDF)

  const header = buffer.subarray(0, 8)
  const hex = header.toString("hex").toUpperCase()

  switch (mimeType) {
    case "image/jpeg":
      return hex.startsWith("FFD8FF")
    case "image/png":
      return hex.startsWith("89504E47")
    case "image/gif":
      return hex.startsWith("47494638")
    case "image/webp":
      return hex.startsWith("52494646") && hex.substring(16, 24) === "57454250"
    case "application/pdf":
      return hex.startsWith("25504446")
    case "image/svg+xml":
      // Basic SVG check: starts with <svg or <?xml
      const svgStart = buffer.subarray(0, 50).toString().toLowerCase()
      return svgStart.includes("<svg") || svgStart.includes("<?xml")
    default:
      // For other types, we might rely on sharp for further validation or assume valid if no signature known
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
