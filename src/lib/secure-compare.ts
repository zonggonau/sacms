import { timingSafeEqual } from "crypto"

/**
 * Constant-time string comparison. Returns false for empty inputs so a missing
 * or unset secret never matches. Use for any secret/token equality check.
 */
export function secureEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}
