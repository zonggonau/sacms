import { z } from "zod"

/**
 * Shared shape/format checks for the owner's "bring your own infrastructure"
 * (BYODB/BYOS) settings — used by both /api/user/infrastructure (save) and
 * /api/user/infrastructure/test-connection (connection test) so the two
 * never drift.
 */
export const MinioConfigSchema = z.object({
  endpoint: z.string().trim().min(1).max(500),
  accessKey: z.string().trim().min(1).max(500),
  secretKey: z.string().trim().min(1).max(500),
  bucket: z.string().trim().min(1).max(255),
})

export type MinioConfigInput = z.infer<typeof MinioConfigSchema>

export function isValidPostgresUrl(url: string): boolean {
  return /^postgres(ql)?:\/\//.test(url)
}
