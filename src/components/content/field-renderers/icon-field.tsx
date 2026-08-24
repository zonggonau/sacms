"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Search,
  Sparkles,
  Shield,
  Star,
  Heart,
  Zap,
  Award,
  Check,
  Bell,
  Book,
  Briefcase,
  Camera,
  Clock,
  Cloud,
  Compass,
  Crown,
  Database,
  Eye,
  Flame,
  Gift,
  Globe,
  Headphones,
  Home,
  Key,
  Laptop,
  Layers,
  Layout,
  Lock,
  Mail,
  Map,
  MapPin,
  MessageSquare,
  Moon,
  Music,
  Package,
  Phone,
  Play,
  Rocket,
  Settings,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Smile,
  Sun,
  Tag,
  ThumbsUp,
  Truck,
  Tv,
  User,
  Users,
  Video,
  Wifi,
  ChevronDown,
  X,
  LucideIcon
} from "lucide-react"

export const AVAILABLE_ICONS: Record<string, LucideIcon> = {
  Sparkles, Shield, Star, Heart, Zap, Award, Check, Bell, Book,
  Briefcase, Camera, Clock, Cloud, Compass, Crown, Database, Eye,
  Flame, Gift, Globe, Headphones, Home, Key, Laptop, Layers,
  Layout, Lock, Mail, Map, MapPin, MessageSquare, Moon, Music,
  Package, Phone, Play, Rocket, Settings, Share2, ShoppingBag,
  ShoppingCart, Smile, Sun, Tag, ThumbsUp, Truck, Tv, User,
  Users, Video, Wifi
}

interface IconFieldProps {
  value: string | null | undefined
  onChange: (value: string) => void
  disabled?: boolean
  required?: boolean
}

export function IconField({
  value,
  onChange,
  disabled = false,
  required = false
}: IconFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const CurrentIcon = value && AVAILABLE_ICONS[value] ? AVAILABLE_ICONS[value] : null

  const filteredIcons = useMemo(() => {
    const q = search.toLowerCase()
    return Object.keys(AVAILABLE_ICONS).filter(name => name.toLowerCase().includes(q))
  }, [search])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="h-10 px-3.5 rounded-xl border-border/80 bg-background hover:bg-muted/40 flex items-center gap-2.5 min-w-[160px] justify-between text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            {CurrentIcon ? (
              <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <CurrentIcon className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 opacity-50" />
              </div>
            )}
            <span className={CurrentIcon ? "text-foreground" : "text-muted-foreground font-normal"}>
              {value || "Pilih Ikon..."}
            </span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 opacity-50 ml-2" />
        </Button>

        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange("")}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Icon Picker Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-border/80 shadow-xl bg-card">
          <DialogHeader className="p-4 bg-card border-b border-border/60 pr-12">
            <DialogTitle className="text-sm font-bold text-foreground">Pilih Ikon Visual</DialogTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cari ikon (contoh: Star, Shield, Heart)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8.5 bg-muted/30 border-border/80 rounded-xl text-xs"
                autoFocus
              />
            </div>
          </DialogHeader>

          <div className="p-4 max-h-[340px] overflow-y-auto">
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
              {filteredIcons.map((iconName) => {
                const IconComponent = AVAILABLE_ICONS[iconName]
                const isSelected = value === iconName

                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => {
                      onChange(iconName)
                      setOpen(false)
                      setSearch("")
                    }}
                    title={iconName}
                    className={`aspect-square flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer group ${
                      isSelected 
                        ? "border-primary bg-primary/10 text-primary ring-2 ring-primary/20" 
                        : "border-border/60 hover:border-border hover:bg-muted/40 text-foreground"
                    }`}
                  >
                    <IconComponent className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] truncate w-full text-center mt-1 text-muted-foreground group-hover:text-foreground">
                      {iconName}
                    </span>
                  </button>
                )
              })}
            </div>

            {filteredIcons.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Tidak ada ikon yang cocok dengan "{search}"
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
