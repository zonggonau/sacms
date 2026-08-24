import {
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  FileText,
  List,
  ImageIcon,
  Link2,
  Box,
  Code,
  Clock,
  Palette,
  Fingerprint,
  Mail,
  FileUp,
  MousePointer2,
  Tags,
  Zap,
  Globe,
  Phone,
  ListChecks,
  Star,
  Banknote,
  CalendarRange,
  Layers,
  KeyRound,
  Percent,
  Shapes,
  MapPin,
  SearchCheck,
  Code2,
} from "lucide-react"

// ==================== REFACTORED FIELD TYPES ====================

export const FIELD_TYPES = [
  // Basic Types
  { type: "text", label: "Text", icon: Type, description: "Short text field", category: "Basic" },
  { type: "textarea", label: "Long Text", icon: FileText, description: "Multi-line text field", category: "Basic" },
  { type: "richText", label: "Rich Text (HTML)", icon: Zap, description: "WYSIWYG editor", category: "Basic" },
  { type: "markdown", label: "Markdown", icon: FileText, description: "Markdown editor", category: "Basic" },
  
  // SEO & Automation
  { type: "slug", label: "Slug", icon: Fingerprint, description: "URL-friendly string, auto-generated", category: "Basic" },

  // Number Types
  { type: "number", label: "Number", icon: Hash, description: "Integer or decimal values", category: "Number" },
  { type: "currency", label: "Currency", icon: Banknote, description: "Nilai uang (contoh: Rp, USD)", category: "Number" },
  { type: "percent", label: "Percentage / Progress", icon: Percent, description: "Nilai persentase 0-100% atau progres bar", category: "Number" },

  // Date & Time
  { type: "date", label: "Date", icon: Calendar, description: "Date picker", category: "Date & Time" },
  { type: "datetime", label: "DateTime", icon: Calendar, description: "Date and time picker", category: "Date & Time" },
  { type: "time", label: "Time", icon: Clock, description: "Time picker", category: "Date & Time" },
  { type: "dateRange", label: "Date Range", icon: CalendarRange, description: "Rentang waktu (Mulai & Selesai)", category: "Date & Time" },

  // Selection & Visual
  { type: "select", label: "Select", icon: List, description: "Dropdown or radio selection", category: "Selection" },
  { type: "multiselect", label: "Multi Select", icon: ListChecks, description: "Pilih banyak opsi sekaligus", category: "Selection" },
  { type: "tags", label: "Tags", icon: Tags, description: "Array of strings", category: "Selection" },
  { type: "icon", label: "Icon Picker", icon: Shapes, description: "Pilih ikon visual (Lucide / Web Icons)", category: "Selection" },

  // Boolean
  { type: "boolean", label: "Boolean", icon: ToggleLeft, description: "True/False toggle", category: "Boolean" },

  // Validation
  { type: "email", label: "Email", icon: Mail, description: "Validated email address", category: "Validation" },
  { type: "password", label: "Password", icon: KeyRound, description: "Teks rahasia tersandi (hashed)", category: "Validation" },
  { type: "url", label: "URL", icon: Globe, description: "Validated URL with preview", category: "Validation" },
  { type: "phone", label: "Phone", icon: Phone, description: "Nomor telepon internasional", category: "Validation" },
  { type: "uid", label: "UID", icon: Fingerprint, description: "Unique identifier", category: "Validation" },

  // Media
  { type: "media", label: "Media", icon: ImageIcon, description: "Single media file", category: "Media" },
  { type: "mediaMultiple", label: "Media (Multiple)", icon: ImageIcon, description: "Gallery or multi-upload", category: "Media" },
  { type: "file", label: "File", icon: FileUp, description: "Document or binary file", category: "Media" },

  // Relations
  { type: "relation", label: "Relation", icon: Link2, description: "Link to another collection", category: "Relations" },
  { type: "component", label: "Component", icon: Box, description: "Reusable field group", category: "Relations" },
  { type: "repeater", label: "Dynamic Zone / Repeater", icon: Layers, description: "Array of multiple components (Polymorphic)", category: "Relations" },

  // Advanced & Composite
  { type: "location", label: "Location / Map", icon: MapPin, description: "Koordinat peta (Latitude, Longitude) dan alamat", category: "Advanced" },
  { type: "seo", label: "SEO Metadata", icon: SearchCheck, description: "Meta title, description, keywords, & OG image", category: "Advanced" },
  { type: "code", label: "Code Snippet", icon: Code2, description: "Editor potongan kode pemrograman multi-bahasa", category: "Advanced" },
  { type: "json", label: "JSON", icon: Code, description: "Custom JSON structure", category: "Advanced" },
  { type: "color", label: "Color", icon: Palette, description: "Color hex picker", category: "Advanced" },
  { type: "rating", label: "Rating", icon: Star, description: "Bintang 1-5 untuk review & penilaian", category: "Advanced" },
  { type: "button", label: "Button / CTA", icon: MousePointer2, description: "Tombol dengan label dan URL", category: "Advanced" },
  { type: "document_template", label: "Format Surat Plugin", icon: FileText, description: "Template DOCX untuk export surat", category: "Advanced" },
] as const

export const FIELD_CATEGORIES = [
  "Basic",
  "Number",
  "Date & Time",
  "Selection",
  "Boolean",
  "Validation",
  "Media",
  "Relations",
  "Advanced",
] as const

export const VALID_FIELD_TYPES = FIELD_TYPES.map(f => f.type)

export type FieldTypeValue = (typeof FIELD_TYPES)[number]["type"]
export type FieldCategory = (typeof FIELD_CATEGORIES)[number]

export interface FieldDefinition {
  id?: string
  name: string
  slug: string
  type: FieldTypeValue | string
  required: boolean
  unique?: boolean
  options?: string | Record<string, unknown> | null
  jsonPath?: string | null
  relationSlug?: string | null
  order?: number
}

