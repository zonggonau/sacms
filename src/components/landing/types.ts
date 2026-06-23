// Landing page data types — shared across all section components

export interface HeroData {
  headline: string
  subheadline?: string
  badge_text?: string
  cta_primary?: string
  cta_secondary?: string
  cta_href?: string
  image_url?: string
}

export interface FeatureItem {
  icon: string
  title: string
  description: string
  color?: string
}

export interface PricingPlan {
  name: string
  description: string
  price: number
  yearly_price?: number
  interval?: string
  period?: string
  features: string[]
  isPopular?: boolean
  cta?: string
}

export interface WorkflowStep {
  step: number
  title: string
  description: string
  icon: string
}

export interface AddonItem {
  icon: string
  name: string
  description: string
  price: number
  unit?: string
}

export interface TestimonialItem {
  name: string
  role?: string
  company?: string
  content: string
  avatar_url?: string
  rating?: number
}

export interface AboutData {
  title: string
  description: string
  mission?: string
  founded?: string
}

export interface OwnerItem {
  name: string
  role?: string
  bio?: string
  avatar_url?: string
  linkedin?: string
}

export interface FaqItem {
  question: string
  answer: string
  order?: number
}

export interface SectorItem {
  icon: string
  label: string
  desc?: string
}

export interface LocalPrideData {
  badge?: string
  title: string
  description: string
}

export interface CtaData {
  title: string
  description: string
  button_primary_text?: string
  button_secondary_text?: string
}

export interface FooterData {
  brand_name?: string
  description?: string
  copyright?: string
}

export interface PapuaHeroData {
  title: string
  subtitle?: string
  primaryCtaText?: string
  primaryCtaLink?: string
  secondaryCtaText?: string
  secondaryCtaLink?: string
}

export interface VisionMissionData {
  vision: string
  mission: string
}

export interface ChallengeData {
  challenge: string
  solution: string
  icon?: string
}

export interface TechConceptData {
  concept: string
  description: string
  benefits?: string
  icon?: string
}

export interface ConnectedSiteData {
  siteName: string
  domain?: string
  platformType?: string
  status?: string
  description?: string
}

export interface DigitalInitiativeData {
  name: string
  region?: string
  impact?: string
  status?: string
}

export interface LandingData {
  hero: HeroData | null
  features: FeatureItem[]
  pricingAccounts: PricingPlan[]
  pricingWorkspaces: PricingPlan[]
  addons: AddonItem[]
  workflow: WorkflowStep[]
  faq: FaqItem[]
  about: AboutData | null
  owners: OwnerItem[]
  testimonials: TestimonialItem[]
  whatsapp: any
  sectors: SectorItem[]
  localPride: LocalPrideData | null
  cta: CtaData | null
  footer: FooterData | null
  // Papua Specific
  papuaHero?: PapuaHeroData | null
  papuaVisionMission?: VisionMissionData | null
  papuaChallenges?: ChallengeData[]
  papuaTechStack?: TechConceptData[]
  papuaConnectedSites?: ConnectedSiteData[]
  papuaInitiatives?: DigitalInitiativeData[]
}
