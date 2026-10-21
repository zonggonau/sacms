/**
 * Normalizes a plan/add-on price field that may arrive from the CMS as a
 * number, a formatted string ("Rp 29.000"), or undefined/null, into a plain
 * integer amount. Shared by the account-level dashboard and billing pages,
 * which both parse pricing content entries the same way.
 */
export function cleanPrice(val: unknown): number {
  if (typeof val === "number") return val
  if (typeof val === "string") return parseInt(val.replace(/[^\d]/g, ""), 10) || 0
  return 0
}

/**
 * Formats an integer IDR amount as "Rp 29.000"; falls back to "Rp 0".
 *
 * Deliberately named differently from src/lib/utils.ts's own `formatRupiah`
 * (which renders a zero amount as "Gratis" instead) — the two used to share
 * the identical name while behaving differently depending on which a page
 * happened to import, which is confusing on its own even though every
 * current caller of each one is unambiguous about which it wants.
 */
export function formatRupiahPlain(amount: number): string {
  return amount > 0 ? `Rp ${amount.toLocaleString("id-ID")}` : "Rp 0"
}
