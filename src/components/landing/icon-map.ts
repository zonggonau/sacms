import {
  Sparkles, Cpu, Layout, Zap, Webhook, Languages,
  GitBranch, Shield, Globe, Database,
  Brain, CreditCard, PenLine, FileEdit, Code2, Rocket,
  Bot, MessageCircle,
  Landmark, Newspaper, ShoppingBag, Palmtree, Coffee,
  Package, Building2, Lightbulb,
  type LucideIcon,
} from "lucide-react"

export const iconMap: Record<string, LucideIcon> = {
  Sparkles, Cpu, Layout, Zap, Webhook, Languages,
  GitBranch, Shield, Globe, Database,
  Brain, CreditCard, PenLine, FileEdit, Code2, Rocket,
  Bot, MessageCircle,
  Landmark, Newspaper, ShoppingBag, Palmtree, Coffee,
  Package, Building2, Lightbulb,
}

export function getIcon(name: string, fallback: LucideIcon = Sparkles): LucideIcon {
  return iconMap[name] || fallback
}
