"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  Sparkles, CheckCircle2, Loader2, ArrowLeft, Database, ExternalLink, Cpu, Zap,
  Paperclip, X, FileUp,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FIELD_TYPES } from "@/lib/field-types"
import { SCHEMA_MODEL_OPTIONS } from "@/lib/ai/schema-models"

export const QUICK_PROMPT_INSPIRATIONS = [
  {
    icon: "🏖️",
    label: "Resor & Pariwisata",
    hint: "Kamar, paket wisata, booking",
    prompt: "Rancang skema untuk Grand Resort & Pariwisata berkelas premium dengan desain modern dan pengalaman digital setara hotel bintang lima: katalog tipe kamar (Deluxe, Ocean Villa) lengkap harga musiman, paket wisata bahari/diving dengan itinerary, fasilitas resto seafood signature, galeri foto beresolusi tinggi, testimoni tamu, dan formulir booking reservasi online yang terintegrasi dengan status ketersediaan kamar real-time.",
  },
  {
    icon: "☕",
    label: "Toko Online UMKM",
    hint: "Produk, varian, checkout WA",
    prompt: "Rancang skema e-commerce untuk UMKM produk kopi dan kerajinan tangan dengan tampilan toko yang modern, cepat, dan profesional: katalog produk filterable per kategori, varian berat/ukuran/warna, harga diskon musiman, program bundling, ulasan & rating bintang pelanggan, badge produk unggulan, dan checkout WhatsApp instan yang membawa ringkasan keranjang otomatis.",
  },
  {
    icon: "📰",
    label: "Portal Berita & Media",
    hint: "Artikel, kategori, headline",
    prompt: "Rancang skema untuk portal media berita digital dengan desain editorial modern ala media nasional: kategori topik (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks dengan dukungan media embed, slot headline breaking news, profil & kredensial jurnalis, tag trending, dan feed pengumuman publik yang selalu ter-update.",
  },
  {
    icon: "🏥",
    label: "Klinik & Jadwal Dokter",
    hint: "Dokter, layanan, janji temu",
    prompt: "Rancang skema untuk profil klinik kesehatan dengan kesan tepercaya, bersih, dan profesional: jadwal praktik dokter spesialis per hari, direktori layanan medis & poliklinik dengan estimasi biaya, artikel edukasi kesehatan, testimoni pasien, dan formulir pendaftaran janji temu online yang memvalidasi slot jadwal yang tersedia.",
  },
  {
    icon: "🎓",
    label: "Sekolah & PPDB Online",
    hint: "Jurusan, prestasi, PPDB",
    prompt: "Rancang skema untuk institusi sekolah/kejuruan dengan citra modern dan membanggakan: profil sekolah & visi-misi, direktori jurusan/program keahlian dengan kurikulum, pengumuman akademik, galeri prestasi & ekstrakurikuler siswa, testimoni alumni, dan formulir pendaftaran PPDB online bertahap dengan status verifikasi berkas.",
  },
  {
    icon: "💼",
    label: "Agensi & Portofolio",
    hint: "Studi kasus, testimoni, pricing",
    prompt: "Rancang skema untuk portofolio agensi digital kreatif dengan estetika premium dan storytelling yang kuat: showcase studi kasus proyek (Web, App, Branding) dengan before/after & hasil terukur, testimoni klien bertanda tangan, paket pricing harga transparan, daftar tim kreatif, dan formulir konsultasi proyek yang menangkap kebutuhan calon klien secara spesifik.",
  },
  {
    icon: "🍽️",
    label: "Restoran & Kafe",
    hint: "Menu, reservasi, ulasan",
    prompt: "Rancang skema untuk restoran & kafe modern dengan nuansa hangat dan menggugah selera: katalog menu (kategori makanan/minuman, harga, foto profesional, level pedas, tag halal/vegan), reservasi meja online dengan konfirmasi otomatis, jam operasional per cabang, galeri suasana resto, dan ulasan pelanggan berbintang.",
  },
  {
    icon: "🏢",
    label: "Properti & Real Estate",
    hint: "Listing, lokasi, agen",
    prompt: "Rancang skema untuk agensi properti dengan presentasi listing yang elegan dan tepercaya: listing rumah/apartemen/tanah (harga, luas tanah/bangunan, jumlah kamar, status jual/sewa), peta lokasi interaktif, profil & sertifikasi agen properti, kalkulator simulasi KPR, dan formulir jadwal survei lokasi.",
  },
  {
    icon: "✈️",
    label: "Travel & Tour Agent",
    hint: "Paket tur, itinerary, booking",
    prompt: "Rancang skema untuk agen travel & tour dengan pengalaman menjelajah yang modern dan inspiratif: katalog paket wisata domestik/luar negeri dengan itinerary hari-per-hari, harga per orang, kuota peserta tersisa, testimoni jamaah/wisatawan bergambar, galeri destinasi sinematik, dan formulir booking trip dengan opsi tanggal keberangkatan.",
  },
  {
    icon: "💪",
    label: "Gym & Fitness Center",
    hint: "Kelas, trainer, membership",
    prompt: "Rancang skema untuk gym & fitness center dengan energi modern dan memotivasi: jadwal kelas (yoga, zumba, HIIT) per instruktur, profil & spesialisasi personal trainer, paket membership & harga dengan perbandingan benefit, before/after transformasi member, dan formulir pendaftaran member baru.",
  },
  {
    icon: "💍",
    label: "Wedding & Event Planner",
    hint: "Paket acara, vendor, galeri",
    prompt: "Rancang skema untuk wedding & event organizer dengan tampilan romantis namun tetap profesional: paket acara (dekorasi, katering, dokumentasi) dengan rincian harga, direktori vendor mitra tepercaya, galeri portofolio acara sebelumnya dengan cerita singkat, testimoni pasangan, dan formulir konsultasi tanggal acara.",
  },
  {
    icon: "🚀",
    label: "SaaS & Startup Teknologi",
    hint: "Fitur produk, pricing tier, FAQ",
    prompt: "Rancang skema untuk landing page produk SaaS/startup teknologi dengan desain futuristik dan konversi tinggi: daftar fitur unggulan dengan ikon & deskripsi singkat, perbandingan paket harga (Free/Pro/Enterprise), studi kasus & metrik keberhasilan pelanggan, logo klien/investor, dan FAQ interaktif yang menjawab keberatan umum calon pelanggan.",
  },
  {
    icon: "🤝",
    label: "Yayasan & NGO Sosial",
    hint: "Program, donasi, laporan",
    prompt: "Rancang skema untuk yayasan/NGO sosial dengan kesan transparan dan dapat dipercaya: katalog program kemanusiaan dengan cerita dampak nyata, progress donasi (target & terkumpul) secara visual, laporan transparansi keuangan berkala, profil relawan/pengurus, dan formulir donasi online dengan pilihan nominal cepat.",
  },
  {
    icon: "🏛️",
    label: "Website Desa & Pemerintahan",
    hint: "Profil desa, berita, layanan publik",
    prompt: "Rancang skema untuk website resmi desa/pemerintahan dengan tampilan formal, informatif, dan modern: profil wilayah & struktur organisasi pemerintahan, berita/pengumuman resmi berkategori, direktori layanan publik & persyaratan dokumen, statistik data penduduk & APBDes, serta galeri potensi/wisata desa.",
  },
  {
    icon: "🚗",
    label: "Dealer Otomotif",
    hint: "Katalog mobil, test drive, kredit",
    prompt: "Rancang skema untuk dealer otomotif dengan presentasi showroom digital yang modern: katalog unit mobil/motor (varian, harga OTR, spesifikasi mesin, galeri 360°), simulasi kredit/cicilan interaktif, jadwal test drive, promo trade-in, dan profil sales konsultan.",
  },
  {
    icon: "👗",
    label: "Fashion & Boutique",
    hint: "Katalog koleksi, ukuran, lookbook",
    prompt: "Rancang skema untuk brand fashion & boutique dengan estetika editorial yang modern dan premium: katalog koleksi pakaian (ukuran, warna, bahan, stok real-time), lookbook musiman bergaya majalah, program loyalti member berjenjang, ulasan fit & kualitas, dan checkout keranjang belanja yang mulus.",
  },
  {
    icon: "🏗️",
    label: "Konstruksi & Arsitek",
    hint: "Proyek, layanan, estimasi biaya",
    prompt: "Rancang skema untuk jasa konstruksi & arsitek dengan kesan presisi dan profesional: portofolio proyek selesai (before/after, luas bangunan, lokasi), daftar layanan (desain, bangun, renovasi) dengan tahapan kerja, estimasi biaya per m², testimoni klien, dan formulir konsultasi proyek dengan unggah sketsa/referensi.",
  },
  {
    icon: "📦",
    label: "Logistik & Ekspedisi",
    hint: "Lacak kiriman, tarif, cabang",
    prompt: "Rancang skema untuk perusahaan logistik & ekspedisi dengan antarmuka operasional yang modern dan andal: fitur lacak status kiriman berdasarkan nomor resi, daftar tarif per rute/berat/jenis layanan, direktori cabang/agen dengan peta, estimasi waktu tiba, dan formulir klaim pengiriman.",
  },
  {
    icon: "📚",
    label: "Kursus & Pendidikan Online",
    hint: "Kelas, instruktur, sertifikat",
    prompt: "Rancang skema untuk platform kursus & pendidikan online dengan pengalaman belajar modern: katalog kelas (kurikulum per modul, durasi, level kesulitan), profil & kredensial instruktur, ulasan & rating peserta, progres belajar, dan sertifikat kelulusan digital yang dapat diverifikasi.",
  },
  {
    icon: "🌾",
    label: "Agribisnis & Pertanian",
    hint: "Komoditas, harga panen, mitra tani",
    prompt: "Rancang skema untuk platform agribisnis modern dengan nuansa segar dan tepercaya: katalog komoditas hasil panen (harga per kg, musim panen, lokasi kebun, sertifikasi organik), direktori mitra petani/kelompok tani, artikel edukasi pertanian berkelanjutan, dan formulir kemitraan/kerja sama distribusi.",
  },
  {
    icon: "⚖️",
    label: "Firma Hukum & Konsultan",
    hint: "Praktik area, profil partner, artikel",
    prompt: "Rancang skema untuk firma hukum & konsultan dengan kesan berwibawa dan profesional: daftar bidang praktik hukum dengan deskripsi lingkup layanan, profil partner/advokat beserta rekam jejak & kredensial, artikel pembaruan regulasi terkini, studi kasus yang berhasil ditangani, dan formulir konsultasi hukum awal yang rahasia.",
  },
  {
    icon: "📸",
    label: "Studio Foto & Videografi",
    hint: "Paket sesi, portofolio, booking",
    prompt: "Rancang skema untuk studio foto & videografi dengan galeri visual sinematik dan modern: paket sesi foto (prewedding, produk, korporat) lengkap harga & durasi, portofolio karya per kategori dengan resolusi tinggi, profil fotografer/videografer, testimoni klien, dan formulir booking sesi dengan pilihan tanggal & lokasi.",
  },
  {
    icon: "🛋️",
    label: "Interior Design & Dekorasi",
    hint: "Portofolio ruang, gaya, konsultasi",
    prompt: "Rancang skema untuk jasa interior design & dekorasi rumah dengan presentasi portofolio yang premium: galeri proyek ruang (gaya minimalis, industrial, klasik) dengan before/after, daftar layanan desain & pengadaan furnitur, moodboard inspirasi, estimasi biaya per ruang, dan formulir konsultasi desain.",
  },
  {
    icon: "💇",
    label: "Barbershop & Salon Kecantikan",
    hint: "Layanan, kapster, booking jam",
    prompt: "Rancang skema untuk barbershop & salon kecantikan dengan tampilan modern dan stylish: daftar layanan (potong rambut, perawatan wajah, nail art) lengkap harga & durasi, profil kapster/beautician dengan spesialisasi, galeri hasil before/after, dan formulir booking jam kedatangan per staf.",
  },
  {
    icon: "🐾",
    label: "Klinik Hewan & Pet Care",
    hint: "Layanan dokter hewan, produk, adopsi",
    prompt: "Rancang skema untuk klinik hewan & pet care dengan kesan hangat dan tepercaya: daftar layanan dokter hewan (vaksinasi, grooming, rawat inap) dengan harga, profil dokter hewan, katalog produk pet shop, program adopsi hewan, dan formulir reservasi kunjungan klinik.",
  },
  {
    icon: "🧑‍💻",
    label: "Coworking Space",
    hint: "Paket ruang, fasilitas, booking meja",
    prompt: "Rancang skema untuk coworking space dengan desain modern dan kolaboratif: katalog paket ruang kerja (hot desk, private office, meeting room) lengkap harga per jam/bulan, daftar fasilitas (wifi, printer, pantry), galeri suasana ruang, member komunitas, dan formulir booking meja/ruang rapat.",
  },
  {
    icon: "🚙",
    label: "Rental Mobil & Transportasi",
    hint: "Katalog unit, tarif, booking",
    prompt: "Rancang skema untuk jasa rental mobil & transportasi dengan antarmuka pemesanan yang modern dan simpel: katalog unit kendaraan (jenis, kapasitas, transmisi, harga per hari), opsi dengan/tanpa sopir, syarat sewa, ulasan pelanggan, dan formulir booking dengan pilihan tanggal jemput-kembali.",
  },
  {
    icon: "🎂",
    label: "Katering & Bakery",
    hint: "Menu, paket acara, pre-order",
    prompt: "Rancang skema untuk usaha katering & bakery dengan tampilan menggugah selera dan profesional: katalog menu (nasi kotak, kue, snack box) dengan harga per porsi/paket, paket untuk acara (pernikahan, kantor, ulang tahun), galeri produk, ulasan rasa, dan formulir pre-order dengan tanggal pengiriman.",
  },
  {
    icon: "💐",
    label: "Toko Bunga & Florist",
    hint: "Katalog rangkaian, custom order, kirim",
    prompt: "Rancang skema untuk toko bunga & florist dengan estetika lembut dan modern: katalog rangkaian bunga per okasi (duka, wisuda, pernikahan) dengan harga, opsi custom order dengan catatan ucapan, area pengiriman & estimasi waktu, galeri karya, dan formulir pemesanan kirim bunga.",
  },
  {
    icon: "🏫",
    label: "Universitas & Perguruan Tinggi",
    hint: "Fakultas, prodi, riset, PMB",
    prompt: "Rancang skema untuk universitas/perguruan tinggi dengan citra akademik yang modern dan kredibel: direktori fakultas & program studi dengan akreditasi, profil dosen & publikasi riset, berita kampus & agenda akademik, galeri fasilitas, dan formulir pendaftaran mahasiswa baru (PMB) bertahap.",
  },
  {
    icon: "🧑‍💼",
    label: "Portal Lowongan Kerja",
    hint: "Lowongan, lamaran, profil perusahaan",
    prompt: "Rancang skema untuk portal lowongan kerja & rekrutmen dengan pengalaman pencarian kerja yang modern: daftar lowongan per kategori/lokasi/gaji, profil perusahaan pemberi kerja, detail kualifikasi & benefit, status lamaran pelamar, dan formulir apply kerja dengan unggah CV.",
  },
  {
    icon: "🛒",
    label: "Marketplace Multi-Vendor",
    hint: "Toko mitra, produk lintas kategori",
    prompt: "Rancang skema untuk marketplace multi-vendor dengan pengalaman belanja modern dan terpercaya: direktori toko mitra dengan rating performa, katalog produk lintas kategori dengan varian & stok per vendor, ulasan pembeli, promo lintas toko, dan status pesanan per vendor.",
  },
  {
    icon: "🛡️",
    label: "Asuransi & Fintech",
    hint: "Produk proteksi, simulasi premi, klaim",
    prompt: "Rancang skema untuk perusahaan asuransi & fintech dengan kesan aman, tepercaya, dan modern: katalog produk proteksi (jiwa, kesehatan, kendaraan) dengan manfaat & premi, simulasi kalkulator premi interaktif, panduan prosedur klaim, artikel literasi keuangan, dan formulir pengajuan polis.",
  },
  {
    icon: "🎙️",
    label: "Podcast & Media Digital",
    hint: "Episode, host, sponsor",
    prompt: "Rancang skema untuk podcast & media digital dengan tampilan kreatif dan modern: katalog episode per season dengan show notes & durasi, profil host & bintang tamu, daftar platform streaming, paket sponsorship untuk brand, dan formulir kerja sama konten.",
  },
  {
    icon: "🕌",
    label: "Rumah Ibadah & Komunitas",
    hint: "Jadwal kegiatan, kajian, donasi",
    prompt: "Rancang skema untuk website rumah ibadah & komunitas dengan nuansa tenang, hangat, dan modern: jadwal kegiatan/kajian rutin, profil pengurus & pengajar, galeri kegiatan sosial, program donasi pembangunan, dan formulir pendaftaran kegiatan/relawan.",
  },
  {
    icon: "🎮",
    label: "Esports & Gaming Community",
    hint: "Turnamen, tim, leaderboard",
    prompt: "Rancang skema untuk komunitas esports & gaming dengan desain futuristik dan dinamis: katalog turnamen (game, jadwal, hadiah), profil tim & pemain dengan statistik, leaderboard peringkat, galeri highlight pertandingan, dan formulir registrasi tim turnamen.",
  },
]

interface SchemaField {
  name: string
  slug: string
  type: string
  required?: boolean
  unique?: boolean
  relationSlug?: string
  componentSlug?: string
}

interface SchemaModel {
  name: string
  slug: string
  description?: string
  fields: SchemaField[]
}

interface SchemaPlan {
  domain: string
  title: string
  summary: string
  contentTypes: SchemaModel[]
  singleTypes: SchemaModel[]
  components: SchemaModel[]
  /** True if the real AI call failed/wasn't configured and a canned blueprint was used instead. */
  usedFallback?: boolean
  fallbackReason?: string
}

interface SchemaStepProps {
  tenantSlug: string
  hasSchema: boolean
  existingSchemaSummary: {
    contentTypes: Array<{ name: string; slug: string; fieldCount: number }>
    singleTypes: Array<{ name: string; slug: string; fieldCount: number }>
  }
  /** Fires after a schema is successfully imported/saved, so the parent can refresh (ER diagram or template list). */
  onSchemaReady: () => void
  /**
   * "import" (default): the usual tenant flow — AI plans a schema, confirming
   * imports it as real Content Types/Single Types/Components.
   * "template": SaCMS Global-only authoring — confirming saves the plan as a
   * reusable SchemaTemplate catalog entry (draft, unpublished) instead.
   */
  mode?: "import" | "template"
}

function FieldBadge({ field }: { field: SchemaField }) {
  const meta = FIELD_TYPES.find((f) => f.type === field.type)
  const Icon = meta?.icon || Database
  return (
    <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-muted/40 border-border/70">
      <Icon className="h-3 w-3 text-muted-foreground" />
      {field.name}
      {field.required && <span className="text-primary">*</span>}
    </Badge>
  )
}

function SchemaModelCard({ model, typeLabel }: { model: SchemaModel; typeLabel: string }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-bold">{model.name}</CardTitle>
          <Badge variant="outline" className="text-[10px] font-bold shrink-0">{typeLabel}</Badge>
        </div>
        {model.description && (
          <CardDescription className="text-xs">{model.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1.5">
          {(model.fields || []).map((f) => (
            <FieldBadge key={f.slug || f.name} field={f} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function SchemaStep({ tenantSlug, hasSchema, existingSchemaSummary, onSchemaReady, mode = "import" }: SchemaStepProps) {
  const router = useRouter()
  const { toast } = useToast()
  const isTemplateMode = mode === "template"

  const [step, setStep] = useState<"compose" | "review">("compose")
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string>(SCHEMA_MODEL_OPTIONS[0].value)
  const [isPlanning, setIsPlanning] = useState(false)
  const [plan, setPlan] = useState<SchemaPlan | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Reference document AI reads alongside the prompt (e.g. a business brief
  // or a sample data export) — read client-side as plain text, folded into
  // the prompt sent to /ai-builder/plan-schema. No binary parsing (PDF/DOCX)
  // on the server, so only text-ish formats are accepted.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null)
  const MAX_ATTACHMENT_BYTES = 400_000
  const MAX_ATTACHMENT_CHARS = 20_000

  const handleFileSelected = (file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast({ variant: "destructive", title: "File Terlalu Besar", description: "Maksimal 400KB untuk dokumen referensi teks." })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result || "")
      setAttachedFile({ name: file.name, content: text.slice(0, MAX_ATTACHMENT_CHARS) })
    }
    reader.onerror = () => {
      toast({ variant: "destructive", title: "Gagal Membaca File", description: "Coba file lain atau salin isinya langsung ke prompt." })
    }
    reader.readAsText(file)
  }

  // Only used in "template" mode — metadata for the SchemaTemplate row.
  const [templateName, setTemplateName] = useState("")
  const [templateCategory, setTemplateCategory] = useState("")
  const [templateIcon, setTemplateIcon] = useState("📦")
  const [templateDescription, setTemplateDescription] = useState("")

  const handlePlanSchema = async () => {
    if (!prompt.trim()) return
    setIsPlanning(true)
    try {
      const fullPrompt = attachedFile
        ? `${prompt}\n\n---\nReferensi dari dokumen terlampir ("${attachedFile.name}"), gunakan sebagai konteks tambahan untuk menyusun skema:\n${attachedFile.content}`
        : prompt
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/plan-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt, model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal merencanakan skema")
      setPlan(data.plan)
      setStep("review")
      if (data.plan?.usedFallback) {
        toast({
          title: "AI Gateway Tidak Tersedia",
          description: "Skema ini dibuat dari blueprint cadangan, bukan hasil AI sesungguhnya — tidak ada kredit yang dipotong. Cek konfigurasi Vercel AI Gateway di Admin > Pengaturan > Mesin AI.",
        })
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Membuat Skema", description: err.message })
    } finally {
      setIsPlanning(false)
    }
  }

  const handleConfirmSchema = async () => {
    if (!plan) return

    if (isTemplateMode) {
      if (!templateName.trim() || !templateCategory.trim()) {
        toast({ variant: "destructive", title: "Lengkapi Detail Template", description: "Nama dan kategori template wajib diisi." })
        return
      }
      setIsImporting(true)
      try {
        const res = await fetch(`/api/tenant/${tenantSlug}/schema-templates`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: templateName.trim(),
            category: templateCategory.trim(),
            icon: templateIcon.trim() || undefined,
            description: templateDescription.trim() || undefined,
            schema: {
              contentTypes: plan.contentTypes,
              singleTypes: plan.singleTypes,
              components: plan.components,
            },
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Gagal menyimpan template")
        toast({ title: "Template Tersimpan", description: `"${templateName}" disimpan sebagai draft — publish dari daftar template agar terlihat tenant lain.` })
        setPlan(null)
        setPrompt("")
        setAttachedFile(null)
        setTemplateName("")
        setTemplateCategory("")
        setTemplateIcon("📦")
        setTemplateDescription("")
        setStep("compose")
        onSchemaReady()
      } catch (err: any) {
        toast({ variant: "destructive", title: "Gagal Menyimpan Template", description: err.message })
      } finally {
        setIsImporting(false)
      }
      return
    }

    setIsImporting(true)
    try {
      const res = await fetch(`/api/tenant/${tenantSlug}/ai-builder/import-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: {
            contentTypes: plan.contentTypes,
            singleTypes: plan.singleTypes,
            components: plan.components,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Gagal menyimpan skema")
      toast({ title: "Schema Tersimpan", description: `${data.imported} struktur berhasil dibuat. Lihat diagram di bawah.` })
      setPlan(null)
      setPrompt("")
      setAttachedFile(null)
      setStep("compose")
      onSchemaReady()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Gagal Menyimpan Skema", description: err.message })
    } finally {
      setIsImporting(false)
    }
  }

  if (step === "review" && plan) {
    const allModels: Array<{ model: SchemaModel; typeLabel: string }> = [
      ...plan.contentTypes.map((m) => ({ model: m, typeLabel: "Content Type" })),
      ...plan.singleTypes.map((m) => ({ model: m, typeLabel: "Single Type" })),
      ...plan.components.map((m) => ({ model: m, typeLabel: "Komponen" })),
    ]
    return (
      <div className="flex flex-1 flex-col py-10">
        <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
          <button
            type="button"
            onClick={() => setStep("compose")}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" /> Ubah Prompt
          </button>

          <div className="text-center space-y-1.5">
            <div className="flex items-center justify-center gap-2 mb-1">
              {plan.usedFallback ? (
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Blueprint Cadangan (bukan AI)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Vercel AI Gateway
                </Badge>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">{plan.title}</h2>
            <p className="text-xs text-muted-foreground">{plan.summary}</p>
            {plan.usedFallback && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 max-w-md mx-auto">
                Vercel AI Gateway tidak merespons, jadi skema ini disusun dari blueprint cadangan, bukan hasil AI sesungguhnya. Tidak ada kredit yang dipotong untuk hasil ini.
                {plan.fallbackReason && <span className="block text-muted-foreground mt-0.5">({plan.fallbackReason})</span>}
              </p>
            )}
          </div>

          {isTemplateMode && (
            <Card className="border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">Detail Template</CardTitle>
                <CardDescription className="text-xs">Diisi sebelum disimpan sebagai draft — bisa diubah lagi nanti dari daftar template.</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nama Template</Label>
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="mis. Website Desa"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Kategori</Label>
                    <Input
                      value={templateCategory}
                      onChange={(e) => setTemplateCategory(e.target.value)}
                      placeholder="mis. Pemerintahan"
                      className="h-9 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ikon</Label>
                    <Input
                      value={templateIcon}
                      onChange={(e) => setTemplateIcon(e.target.value)}
                      className="h-9 w-16 text-center text-sm rounded-xl"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deskripsi (opsional)</Label>
                  <Textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Ringkasan singkat untuk tenant yang menjelajahi galeri template"
                    className="resize-none min-h-[60px] text-xs rounded-xl"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {allModels.map(({ model, typeLabel }) => (
              <SchemaModelCard key={model.slug || model.name} model={model} typeLabel={typeLabel} />
            ))}
          </div>

          <div className="flex flex-col items-center gap-1.5 pt-1">
            <Button
              onClick={handleConfirmSchema}
              disabled={isImporting || allModels.length === 0}
              className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto"
            >
              {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isImporting
                ? (isTemplateMode ? "Menyimpan Template..." : "Menyimpan Skema...")
                : (isTemplateMode ? "Simpan sebagai Template" : "Konfirmasi & Simpan Schema")}
            </Button>
            {allModels.length === 0 && (
              <p className="text-[11px] text-destructive">Tidak ada struktur yang bisa disimpan — ubah prompt dan coba lagi.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // step === "compose"
  const totalExisting = existingSchemaSummary.contentTypes.length + existingSchemaSummary.singleTypes.length
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10">
      <div className="w-full max-w-2xl mx-auto px-4 space-y-5">
        {!isTemplateMode && hasSchema && (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Schema Anda sudah punya {totalExisting} struktur data — lihat diagram-nya di bawah, atau tambah lagi lewat prompt di sini.
          </div>
        )}

        <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight text-center">
          {isTemplateMode ? "Jelaskan jenis template yang ingin dibuat" : "Jelaskan jenis website/bisnis Anda"}
        </h2>
        <p className="text-xs text-muted-foreground text-center max-w-md mx-auto">
          {isTemplateMode
            ? "AI akan merancang struktur data untuk template ini. Anda bisa meninjau dan mengubahnya sebelum disimpan sebagai draft."
            : "AI akan merancang struktur data (content types & fields) untuk website Anda. Anda bisa meninjau dan mengubahnya sebelum disimpan."}
        </p>

        <div className="rounded-2xl bg-card border border-border/80 shadow-md overflow-visible">
          <Textarea
            placeholder="Contoh: Website resor & pariwisata dengan katalog kamar, paket wisata, dan galeri..."
            className="resize-none min-h-[96px] text-sm rounded-2xl border-0 shadow-none bg-transparent p-4 focus-visible:ring-0"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handlePlanSchema()
              }
            }}
          />

          {attachedFile && (
            <div className="flex items-center gap-2 px-4 pb-2">
              <Badge variant="outline" className="gap-1.5 text-[11px] font-semibold bg-primary/5 border-primary/20 text-foreground max-w-full">
                <FileUp className="h-3 w-3 text-primary shrink-0" />
                <span className="truncate max-w-[220px]">{attachedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                  aria-label="Hapus file"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </div>
          )}

          <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-1 border-t border-border/50">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.csv,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
                e.target.value = ""
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload dokumen referensi (.txt, .md, .csv, .json) agar AI menganalisanya"
              className="flex items-center gap-1 h-7 px-1.5 rounded-lg text-[11px] font-semibold text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
            <Cpu className="h-3 w-3 text-muted-foreground shrink-0" />
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="h-7 w-auto gap-1.5 rounded-lg border-0 bg-transparent px-1.5 text-[11px] font-semibold shadow-none hover:bg-muted/50 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border bg-card">
                {SCHEMA_MODEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs rounded-lg">
                    <span className="font-semibold">{opt.label}</span>
                    <span className="text-muted-foreground ml-1.5">— {opt.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
              <Zap className="h-2.5 w-2.5" /> Vercel AI Gateway
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center -mt-2">
          Opsional: lampirkan dokumen referensi (.txt, .md, .csv, .json) — AI akan membacanya sebagai konteks tambahan untuk menyusun skema.
        </p>

        <div className="flex flex-col items-center gap-2">
          <Button
            onClick={handlePlanSchema}
            disabled={isPlanning || !prompt.trim()}
            className="h-10 px-6 rounded-full font-bold text-xs gap-1.5 w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs"
          >
            {isPlanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {isPlanning ? "Merencanakan Skema via Gateway..." : isTemplateMode ? "Rencanakan Template dengan AI" : "Generate Schema via Vercel AI Gateway (-5 Credits)"}
          </Button>
          {!isTemplateMode && (
            <p className="text-[10px] text-muted-foreground">
              Ditenagai Vercel AI Gateway. Otomatis memakai blueprint gratis jika saldo AI Credit tidak cukup.
            </p>
          )}
        </div>

        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-bold text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Ide Cepat
          </span>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {QUICK_PROMPT_INSPIRATIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPrompt(item.prompt)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-medium bg-muted/40 hover:bg-primary/10 hover:text-primary hover:border-primary/30 border border-border/60 transition-all text-muted-foreground cursor-pointer"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>


        {!isTemplateMode && (
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/${tenantSlug}/developer/content-types/new`)}
              className="text-[11px] font-semibold text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              atau buat manual <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
