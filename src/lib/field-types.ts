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
  MapPin,
  Fingerprint,
  Mail,
  FileUp,
  MousePointer2,
  Tags,
  Zap,
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

  // Date & Time
  { type: "date", label: "Date", icon: Calendar, description: "Date picker", category: "Date & Time" },
  { type: "datetime", label: "DateTime", icon: Calendar, description: "Date and time picker", category: "Date & Time" },
  { type: "time", label: "Time", icon: Clock, description: "Time picker", category: "Date & Time" },

  // Selection
  { type: "select", label: "Select", icon: List, description: "Dropdown or radio selection", category: "Selection" },
  { type: "tags", label: "Tags", icon: Tags, description: "Array of strings", category: "Selection" },

  // Boolean
  { type: "boolean", label: "Boolean", icon: ToggleLeft, description: "True/False toggle", category: "Boolean" },

  // Validation
  { type: "email", label: "Email", icon: Mail, description: "Validated email address", category: "Validation" },
  { type: "uid", label: "UID", icon: Fingerprint, description: "Unique identifier", category: "Validation" },

  // Media
  { type: "media", label: "Media", icon: ImageIcon, description: "Single media file", category: "Media" },
  { type: "mediaMultiple", label: "Media (Multiple)", icon: ImageIcon, description: "Gallery or multi-upload", category: "Media" },
  { type: "file", label: "File", icon: FileUp, description: "Document or binary file", category: "Media" },

  // Relations
  { type: "relation", label: "Relation", icon: Link2, description: "Link to another collection", category: "Relations" },
  { type: "component", label: "Component", icon: Box, description: "Reusable field group", category: "Relations" },

  // Advanced
  { type: "json", label: "JSON", icon: Code, description: "Custom JSON structure", category: "Advanced" },
  { type: "color", label: "Color", icon: Palette, description: "Color hex picker", category: "Advanced" },
  { type: "location", label: "Location", icon: MapPin, description: "Geographical coordinates", category: "Advanced" },
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
