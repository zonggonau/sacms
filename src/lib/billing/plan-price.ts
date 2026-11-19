export function resolveYearlyPrice(monthlyPrice: number, yearlyPrice?: number | null): number {
  return yearlyPrice ?? monthlyPrice * 10
}
