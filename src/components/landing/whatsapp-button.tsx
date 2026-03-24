"use client"

import { MessageCircle } from "lucide-react"
import { cn } from "@/lib/utils"

interface WhatsAppButtonProps {
  phone: string
  message?: string
  label?: string
  isActive: boolean
}

export function WhatsAppButton({ phone, message, label, isActive }: WhatsAppButtonProps) {
  if (!isActive || !phone) return null

  // Helper to strip HTML tags and common entities
  const cleanMessage = (html: string) => {
    if (!html) return ""
    return html
      .replace(/<[^>]*>?/gm, '') // Strip HTML tags
      .replace(/&nbsp;/g, ' ')    // Replace &nbsp;
      .replace(/&amp;/g, '&')     // Replace &amp;
      .replace(/&quot;/g, '"')    // Replace &quot;
      .replace(/&lt;/g, '<')      // Replace &lt;
      .replace(/&gt;/g, '>')      // Replace &gt;
      .trim()
  }

  const waUrl = `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(cleanMessage(message || ""))}`

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-[#25D366] text-white shadow-2xl hover:scale-105 transition-all duration-300 group"
      )}
    >
      <MessageCircle className="w-6 h-6 fill-current" />
      {label && (
        <span className="font-bold text-sm max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap">
          {label}
        </span>
      )}
    </a>
  )
}
