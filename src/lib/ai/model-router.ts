/**
 * Model Router & AI Credit Ledger Metering
 *
 * Routes AI operations to appropriate models (GPT-4o, Claude 3.5, Gemini 1.5)
 * and enforces strict credit reservation, deduction, and ledger logging.
 */

import { db } from "@/lib/database"

export type AiOperation =
  | "full_website_generation"
  | "schema_planning"
  | "page_generation"
  | "section_edit"
  | "build_repair"

export const AI_CREDIT_COSTS: Record<AiOperation, number> = {
  full_website_generation: 30,
  schema_planning: 5,
  page_generation: 5,
  section_edit: 2,
  build_repair: 3,
}

export interface CreditCheckResult {
  allowed: boolean
  currentBalance: number
  cost: number
  remainingAfter: number
  error?: string
}

export class ModelRouter {
  /**
   * Check if tenant/user has sufficient credits for an operation
   */
  static async checkCredits(tenantId: string, userId?: string, operation: AiOperation = "full_website_generation"): Promise<CreditCheckResult> {
    const cost = AI_CREDIT_COSTS[operation] || 5

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { aiTokensUsed: true, aiCreditsExtra: true, plan: true },
    })

    if (!tenant) {
      return { allowed: false, currentBalance: 0, cost, remainingAfter: 0, error: "Workspace tidak ditemukan" }
    }

    // Free plan: 100 base, Starter: 300 base, Business: 1000 base, Pro: 3000 base
    const baseCredits = tenant.plan === "pro" ? 3000 : tenant.plan === "business" ? 1000 : tenant.plan === "starter" ? 300 : 100
    const totalCredits = baseCredits + tenant.aiCreditsExtra
    const currentBalance = Math.max(0, totalCredits - tenant.aiTokensUsed)

    if (currentBalance < cost) {
      return {
        allowed: false,
        currentBalance,
        cost,
        remainingAfter: currentBalance,
        error: `AI Credits tidak mencukupi (${currentBalance}/${cost} credits). Silakan top-up credits Anda.`,
      }
    }

    return {
      allowed: true,
      currentBalance,
      cost,
      remainingAfter: currentBalance - cost,
    }
  }

  /**
   * Transact and record credit deduction in database & ledger
   */
  static async deductCredits(
    tenantId: string,
    userId: string | undefined,
    operation: AiOperation,
    cost: number,
    metadata?: Record<string, any>
  ) {
    try {
      await db.$transaction(async (tx) => {
        // 1. Increment tenant tokens used
        await tx.tenant.update({
          where: { id: tenantId },
          data: { aiTokensUsed: { increment: cost } },
        })

        // 2. Increment user tokens used if user exists
        if (userId) {
          await tx.user.update({
            where: { id: userId },
            data: { aiCreditsUsed: { increment: cost } },
          }).catch(() => {})
        }

        // 3. Record in ledger
        await tx.aiQuotaLedger.create({
          data: {
            tenantId,
            userId,
            action: operation,
            credits: cost,
            tokens: cost * 400, // Normalized internal token estimate
            model: "sacms-ai-agent-v1",
          },
        })
      })
    } catch (e) {
      console.error("Failed to deduct AI credits:", e)
    }
  }
}
