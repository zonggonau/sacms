import { z } from "zod/v4"

// Pricing plan slugs are stable identifiers referenced by checkout/billing
// code (PLAN_PRICES, Subscription.plan, addon checkout aliases, etc.) and
// already include underscores in real data (storage_5gb_1y, ai_writer) —
// unlike content-type slugs elsewhere, these are never kebab-case-only.
const pricingSlugSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9]+([_-][a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with dashes/underscores")

const featuresSchema = z.array(z.string()).optional().nullable()

export const accountPlanSchema = z.object({
  slug: pricingSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().min(0),
  yearlyPrice: z.coerce.number().min(0).optional().nullable(),
  maxWorkspaces: z.coerce.number().int().min(0),
  features: featuresSchema,
  isPopular: z.boolean().optional(),
  ctaText: z.string().max(100).optional().nullable(),
  ctaHref: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
})
export type AccountPlanInput = z.infer<typeof accountPlanSchema>

export const workspacePlanSchema = z.object({
  slug: pricingSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  price: z.coerce.number().min(0),
  yearlyPrice: z.coerce.number().min(0).optional().nullable(),
  maxContentTypes: z.coerce.number().int().min(0),
  maxContentEntries: z.coerce.number().int().min(0),
  maxTeamMembers: z.coerce.number().int().min(0),
  maxStorageMb: z.coerce.number().int().min(0),
  maxLocales: z.coerce.number().int().min(0),
  maxApiCalls: z.coerce.number().int().min(0),
  fairUseBandwidthGb: z.coerce.number().int().min(0).optional().nullable(),
  features: featuresSchema,
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
})
export type WorkspacePlanInput = z.infer<typeof workspacePlanSchema>

export const aiCreditPackSchema = z.object({
  slug: pricingSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  credits: z.coerce.number().int().min(0),
  priceUsd: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  badge: z.string().max(100).optional().nullable(),
  features: featuresSchema,
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
})
export type AiCreditPackInput = z.infer<typeof aiCreditPackSchema>

export const addonSchema = z.object({
  slug: pricingSlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  icon: z.string().max(100).optional().nullable(),
  price: z.coerce.number().min(0).optional().nullable(),
  priceLabel: z.string().max(100).optional().nullable(),
  unit: z.string().max(50).optional().nullable(),
  featureKey: z.string().max(100).optional().nullable(),
  checkoutAlias: z.string().max(128).optional().nullable(),
  yearlyPrice: z.coerce.number().min(0).optional().nullable(),
  isTopup: z.boolean().optional(),
  quotaType: z.string().max(50).optional().nullable(),
  amountUnits: z.coerce.number().min(0).optional().nullable(),
  billingPeriod: z.string().max(50).optional().nullable(),
  features: featuresSchema,
  isActive: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
})
export type AddonInput = z.infer<typeof addonSchema>
