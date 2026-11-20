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
  price_label?: string
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
  image?: string
  metric2_label?: string
  metric2_value?: string
  metric3_label?: string
  metric3_value?: string
  metric4_label?: string
  metric4_value?: string
}

export interface OwnerItem {
  name: string
  role?: string
  bio?: string
  avatar_url?: string
  linkedin?: string
}

export interface BlogItem {
  title: string
  excerpt: string
  date: string
  author?: string
  image_url?: string
  slug?: string
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

export interface WebsiteTemplateItem {
  id: string
  name: string
  slug: string
  icon: string
  description: string
  demoUrl: string | null
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

/** Badge/title/description/CTA header block shared by /fitur, /harga, and
 *  /tentang — each page keeps its own copy of this shape so one page's
 *  edit never affects another's. */
export interface PageHeroData {
  badge?: string
  title?: string
  description?: string
  cta_primary?: string
  cta_secondary?: string
}

/** Homepage-only "section intro" copy — badge/title/description, no CTA. */
export interface SectionIntroData {
  badge?: string
  title?: string
  description?: string
  cta_label?: string
}

export interface LandingData {
  hero: HeroData | null
  fiturHero?: PageHeroData | null
  hargaHero?: PageHeroData | null
  tentangHero?: PageHeroData | null
  homepageTechIntro?: SectionIntroData | null
  homepageAiAgentIntro?: SectionIntroData | null
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
  websiteTemplates: WebsiteTemplateItem[]
  localPride: LocalPrideData | null
  cta: CtaData | null
  footer: FooterData | null
  blogs: BlogItem[]
  // Papua Specific
  papuaHero?: PapuaHeroData | null
  papuaVisionMission?: VisionMissionData | null
  papuaChallenges?: ChallengeData[]
  papuaTechStack?: TechConceptData[]
  papuaConnectedSites?: ConnectedSiteData[]
  papuaInitiatives?: DigitalInitiativeData[]
}
