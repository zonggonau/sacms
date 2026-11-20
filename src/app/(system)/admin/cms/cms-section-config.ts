import {
  Sparkles,
  LayoutGrid,
  Workflow,
  HelpCircle,
  Users,
  MessageSquareQuote,
  Building2,
  Heart,
  Megaphone,
  Info,
  Phone,
  PanelBottom,
  Zap,
  CreditCard,
  Users2,
  type LucideIcon,
} from "lucide-react"

export type CmsFieldType = "text" | "textarea" | "richtext" | "number" | "boolean" | "image"

export interface CmsFieldConfig {
  key: string
  label: string
  type: CmsFieldType
  hint?: string
}

export interface CmsSectionConfig {
  key: string
  label: string
  icon: LucideIcon
  kind: "object" | "array"
  description: string
  fields: CmsFieldConfig[]
  /** Which field's value to show as an array item's collapsed title. */
  itemLabelField?: string
}

/**
 * One entry per editable piece of the shared `sacms-landing-page` data —
 * drives both the SPA's section nav and its generic object/array field
 * renderer, so adding a field here is the only change needed to surface it.
 * Field keys/shapes are taken straight from scripts/seed/seed-all-global.ts'
 * real component schemas, not from the richer (partly unused) fallback
 * shape in src/lib/default-landing-page.ts.
 */
export const CMS_SECTIONS: CmsSectionConfig[] = [
  {
    key: "hero",
    label: "Hero",
    icon: Sparkles,
    kind: "object",
    description: "Bagian paling atas halaman utama — judul, sub judul, dan tombol aksi.",
    fields: [
      { key: "badge", label: "Teks Badge", type: "text" },
      { key: "title", label: "Judul Utama", type: "text" },
      { key: "subtitle", label: "Sub Judul", type: "textarea" },
      { key: "cta_primary", label: "Teks Tombol Utama", type: "text" },
      { key: "cta_secondary", label: "Teks Tombol Sekunder", type: "text" },
      { key: "image", label: "Gambar Hero", type: "image" },
    ],
  },
  {
    key: "fitur_hero",
    label: "Header Halaman Fitur",
    icon: Zap,
    kind: "object",
    description: "Badge, judul, deskripsi, dan tombol aksi di bagian atas halaman /fitur.",
    fields: [
      { key: "badge", label: "Teks Badge", type: "text" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "cta_primary", label: "Teks Tombol Utama", type: "text" },
      { key: "cta_secondary", label: "Teks Tombol Sekunder", type: "text" },
    ],
  },
  {
    key: "harga_hero",
    label: "Header Halaman Harga",
    icon: CreditCard,
    kind: "object",
    description: "Badge, judul, deskripsi, dan tombol aksi di bagian atas halaman /harga.",
    fields: [
      { key: "badge", label: "Teks Badge", type: "text" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "cta_primary", label: "Teks Tombol Utama", type: "text" },
      { key: "cta_secondary", label: "Teks Tombol Sekunder", type: "text" },
    ],
  },
  {
    key: "tentang_hero",
    label: "Header Halaman Tentang",
    icon: Users2,
    kind: "object",
    description: "Badge, judul, deskripsi, dan tombol aksi di bagian atas halaman /tentang.",
    fields: [
      { key: "badge", label: "Teks Badge", type: "text" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "cta_primary", label: "Teks Tombol Utama", type: "text" },
      { key: "cta_secondary", label: "Teks Tombol Sekunder", type: "text" },
    ],
  },
  {
    key: "features",
    label: "Fitur",
    icon: LayoutGrid,
    kind: "array",
    description: "Daftar fitur unggulan SaCMS yang ditampilkan di halaman utama & Fitur.",
    itemLabelField: "title",
    fields: [
      { key: "icon", label: "Nama Ikon (Lucide)", type: "text", hint: "Contoh: Shield, Zap, Database" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "tag", label: "Tag", type: "text" },
      { key: "is_main", label: "Fitur Utama", type: "boolean" },
    ],
  },
  {
    key: "workflows",
    label: "Cara Kerja",
    icon: Workflow,
    kind: "array",
    description: "Langkah-langkah alur kerja SaCMS (Daftar → Buat Workspace → ...).",
    itemLabelField: "title",
    fields: [
      { key: "step", label: "Nomor Langkah", type: "text" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "icon", label: "Nama Ikon (Lucide)", type: "text", hint: "Contoh: UserPlus, Building, Code" },
    ],
  },
  {
    key: "faqs",
    label: "FAQ",
    icon: HelpCircle,
    kind: "array",
    description: "Pertanyaan yang sering diajukan.",
    itemLabelField: "question",
    fields: [
      { key: "question", label: "Pertanyaan", type: "text" },
      { key: "answer", label: "Jawaban", type: "textarea" },
    ],
  },
  {
    key: "owners",
    label: "Tim / Founder",
    icon: Users,
    kind: "array",
    description: "Profil tim inti yang ditampilkan di halaman utama.",
    itemLabelField: "name",
    fields: [
      { key: "name", label: "Nama", type: "text" },
      { key: "role", label: "Jabatan", type: "text" },
      { key: "bio", label: "Bio", type: "textarea" },
      { key: "avatar_url", label: "Foto", type: "image" },
      { key: "linkedin", label: "URL LinkedIn", type: "text" },
    ],
  },
  {
    key: "testimonials",
    label: "Testimoni",
    icon: MessageSquareQuote,
    kind: "array",
    description: "Testimoni pelanggan.",
    itemLabelField: "name",
    fields: [
      { key: "name", label: "Nama", type: "text" },
      { key: "role", label: "Jabatan", type: "text" },
      { key: "company", label: "Perusahaan", type: "text" },
      { key: "content", label: "Isi Testimoni", type: "textarea" },
      { key: "avatar_url", label: "Foto", type: "image" },
      { key: "rating", label: "Rating (1-5)", type: "number" },
    ],
  },
  {
    key: "sectors",
    label: "Sektor",
    icon: Building2,
    kind: "array",
    description: "Sektor/industri target yang ditonjolkan di halaman utama.",
    itemLabelField: "label",
    fields: [
      { key: "icon", label: "Nama Ikon (Lucide)", type: "text", hint: "Contoh: Building2, Landmark, Code2" },
      { key: "label", label: "Label", type: "text" },
      { key: "desc", label: "Deskripsi", type: "textarea" },
    ],
  },
  {
    key: "local_pride",
    label: "Local Pride (Papua)",
    icon: Heart,
    kind: "object",
    description: "Section identitas Papua Tengah di halaman utama.",
    fields: [
      { key: "badge", label: "Teks Badge", type: "text" },
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
    ],
  },
  {
    key: "cta_banner",
    label: "CTA Banner",
    icon: Megaphone,
    kind: "object",
    description: "Banner ajakan mendaftar sebelum footer.",
    fields: [
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "button_primary_text", label: "Teks Tombol Utama", type: "text" },
      { key: "button_secondary_text", label: "Teks Tombol Sekunder", type: "text" },
    ],
  },
  {
    key: "about",
    label: "Tentang Kami",
    icon: Info,
    kind: "object",
    description: "Konten halaman Tentang Kami.",
    fields: [
      { key: "title", label: "Judul", type: "text" },
      { key: "description", label: "Deskripsi", type: "richtext" },
      { key: "mission", label: "Misi", type: "textarea" },
      { key: "founded", label: "Tahun Berdiri", type: "text" },
      { key: "image", label: "Gambar", type: "image" },
    ],
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: Phone,
    kind: "object",
    description: "Tombol kontak WhatsApp mengambang.",
    fields: [
      { key: "phone", label: "Nomor Telepon", type: "text", hint: "Format: 62812xxxxxxx" },
      { key: "message", label: "Pesan Awal", type: "textarea" },
      { key: "label", label: "Label Tombol", type: "text" },
      { key: "is_active", label: "Aktif", type: "boolean" },
    ],
  },
  {
    key: "footer",
    label: "Footer",
    icon: PanelBottom,
    kind: "object",
    description: "Teks brand dan copyright di footer.",
    fields: [
      { key: "brand_name", label: "Nama Brand", type: "text" },
      { key: "description", label: "Deskripsi", type: "textarea" },
      { key: "copyright", label: "Teks Copyright", type: "text" },
    ],
  },
]
