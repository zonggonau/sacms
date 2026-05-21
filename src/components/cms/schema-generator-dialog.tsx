"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, Loader2, Wand2, X, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

interface SchemaGeneratorDialogProps {
  tenantSlug: string
  type: "schema" | "single-type" | "component"
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function SchemaGeneratorDialog({
  tenantSlug,
  type,
  open,
  onOpenChange,
  onSuccess,
}: SchemaGeneratorDialogProps) {
  const [loading, setLoading] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const typeLabels = {
    "schema": "Collection Type",
    "single-type": "Single Type",
    "component": "Component"
  }

  const apiEndpoints = {
    "schema": `/api/tenant/${tenantSlug}/ai/generate-schema`,
    "single-type": `/api/tenant/${tenantSlug}/ai/generate-single-type`,
    "component": `/api/tenant/${tenantSlug}/ai/generate-component`
  }

  const handleGenerate = async () => {
    if (!prompt) return
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(apiEndpoints[type], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      
      const data = await res.json()
      
      if (res.ok) {
        toast({ 
          title: "AI Success!", 
          description: `${typeLabels[type]} "${data.name}" has been generated. Redirecting...`,
          className: "bg-muted border border-border text-foreground rounded-none shadow-none"
        })
        
        onOpenChange(false)
        setPrompt("")
        
        if (onSuccess) {
          onSuccess()
        } else {
          // Default redirect
          const pathMap = {
            "schema": "content-types",
            "single-type": "single-types",
            "component": "components"
          }
          router.push(`/dashboard/${tenantSlug}/${pathMap[type]}/edit/${data.slug}`)
        }
      } else {
        setError(data.error || "Failed to generate schema. Please try again.")
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
      toast({ variant: "destructive", title: "AI Error", description: err.message })
    } finally {
      setLoading(false)
    }
  }

  const templates = {
    schema: [
      { label: "Blog Post", prompt: "Buat skema Blog Post dengan: judul, slug, ringkasan, konten utama (rich text), gambar unggulan (media), kategori (relation), penulis (relation), tag (json), estimasi waktu baca (number), dan status unggulan (boolean)." },
      { label: "CMS User/Staff", prompt: "Buat skema User untuk pengelola CMS dengan field: nama lengkap, username (uid), email (email), foto profil (media), jabatan (select), bio singkat (textarea), departemen (relation), dan status aktif (boolean). Model ini akan digunakan untuk mengelola akses pengguna." },
      { label: "Berita", prompt: "Buat skema untuk Berita yang memiliki field: judul, slug (uid), ringkasan (textarea), konten utama (rich text), gambar utama (media), kategori (select), tag (json), penulis (relation), dan tanggal publikasi." },
      { label: "Pengumuman", prompt: "Buat skema Pengumuman Resmi dengan field: judul pengumuman, slug, isi pengumuman (rich text), file lampiran (mediaMultiple), kategori (select: Umum, Kepegawaian, Layanan), tanggal mulai tampil, dan tanggal berakhir (date)." },
      { label: "Dokumen Publikasi", prompt: "Buat skema Dokumen Publikasi dengan field: nama dokumen, deskripsi singkat, kategori dokumen (select: Laporan, Regulasi, Panduan, Riset), file dokumen (media), tanggal rilis, dan instansi penerbit." },
      { label: "Agenda Acara", prompt: "Buat skema Agenda Kegiatan dengan field: nama acara, poster (media), deskripsi lengkap, lokasi (text), koordinat map (text), tanggal mulai, tanggal selesai, link pendaftaran, dan penyelenggara." },
      { label: "Produk Katalog", prompt: "Buat skema Produk dengan field: nama produk, SKU, deskripsi, harga (number), stok (integer), gambar produk (mediaMultiple), spesifikasi (json), brand (select), dan status diskon (boolean)." },
      { label: "Properti/Rumah", prompt: "Buat skema Listing Properti dengan field: nama properti, lokasi, harga (number), luas tanah (number), luas bangunan, jumlah kamar tidur, jumlah kamar mandi, fasilitas (json), dan galeri foto (mediaMultiple)." },
      { label: "Kursus/E-learning", prompt: "Buat skema Kursus dengan field: judul kursus, tingkat kesulitan (select: Beginner, Intermediate, Advanced), harga, durasi total, instruktur (relation), materi pembelajaran (rich text), dan sertifikat (boolean)." },
      { label: "Portofolio", prompt: "Buat skema Project Portofolio dengan field: nama project, klien, kategori project, gambar gallery (mediaMultiple), deskripsi teknis, teknologi yang digunakan (select multiple), link demo, dan tahun selesai." },
      { label: "Testimoni", prompt: "Buat skema Testimoni Pelanggan dengan field: nama pemberi, perusahaan/jabatan, foto (media), isi testimoni (textarea), rating (number 1-5), dan status verifikasi (boolean)." },
      { label: "Tim Kami", prompt: "Buat skema Anggota Tim dengan field: nama lengkap, jabatan, foto profil (media), bio singkat, email, link linkedin, urutan tampil (number), dan departemen (select)." },
      { label: "Partner/Klien", prompt: "Buat skema Partner/Logo Klien dengan field: nama perusahaan, logo (media), link website, dan kategori partner (select: Platinum, Gold, Silver)." },
      { label: "Galeri Foto", prompt: "Buat skema Album Galeri dengan field: judul album, deskripsi, cover image (media), koleksi foto (mediaMultiple), dan tanggal event." },
      { label: "FAQ", prompt: "Buat skema Tanya Jawab (FAQ) dengan field: pertanyaan, jawaban (rich text), kategori (select: Pembayaran, Teknis, Umum), dan urutan prioritas." },
      { label: "Lowongan Kerja", prompt: "Buat skema Karir/Job dengan field: posisi jabatan, tipe pekerjaan (select: Full-time, Remote, Contract), lokasi, deskripsi tugas, persyaratan, gaji (text), dan batas akhir lamaran." },
      { label: "Newsletter", prompt: "Buat skema Subscriber Newsletter dengan field: email, nama lengkap, status aktif (boolean), dan tanggal bergabung." }
    ],
    "single-type": [
      { label: "Landing Page", prompt: "Buat Single Type untuk Landing Page dengan field: hero title, hero subtitle, hero image, CTA button text, CTA link, section features (component), dan SEO metadata." },
      { label: "Tentang Kami", prompt: "Buat Single Type About Us dengan field: visi perusahaan, misi (textarea), sejarah singkat (rich text), video company profile (text/url), dan jumlah klien puas (number)." },
      { label: "Hubungi Kami", prompt: "Buat Single Type untuk halaman Kontak dengan field: alamat kantor pusat, nomor whatsapp, email support, koordinat google maps, jam operasional, dan link social media." },
      { label: "Kebijakan Privasi", prompt: "Buat Single Type Privacy Policy dengan field: judul halaman, isi kebijakan (rich text), dan tanggal terakhir diperbarui." },
      { label: "Navigasi/Menu", prompt: "Buat Single Type Menu Navigasi dengan field: logo navbar (media), list menu utama (json), link tombol login, dan status sticky header (boolean)." },
      { label: "Pengaturan SEO", prompt: "Buat Single Type Global SEO dengan field: default meta title, meta description, favicon, share image (og:image), Google Search Console ID, dan sitemap status." },
      { label: "Pengaturan Global", prompt: "Buat Single Type Site Settings dengan field: logo website, favicon, nama situs, deskripsi SEO, Google Analytics ID, email admin, dan status Maintenance Mode (boolean)." },
      { label: "Footer Config", prompt: "Buat Single Type Footer dengan field: deskripsi copyright, link kebijakan privasi, link syarat ketentuan, dan daftar alamat cabang (json)." }
    ],
    component: [
      { label: "Pricing Card", prompt: "Buat komponen Pricing Card dengan field: nama paket, harga, list fitur (json/text), label tombol, link tombol, dan status 'Paling Populer' (boolean)." },
      { label: "Hero Banner", prompt: "Buat komponen Hero dengan field: title, subtitle, background image (media), overlay opacity (number), dan primary action link." },
      { label: "Feature Item", prompt: "Buat komponen Feature dengan field: judul fitur, deskripsi singkat, ikon (media), dan warna aksen." },
      { label: "Accordion/FAQ", prompt: "Buat komponen Accordion untuk FAQ dengan field: title/pertanyaan, content/jawaban (rich text), dan status default open (boolean)." },
      { label: "Stat Counter", prompt: "Buat komponen Statistik dengan field: label (e.g. Total User), angka (number), simbol (e.g. + atau %), dan durasi animasi." },
      { label: "Social Link", prompt: "Buat komponen Social Media Link dengan field: nama platform (select: Facebook, Instagram, X, LinkedIn), URL profil, dan status aktif." },
      { label: "Logo Grid", prompt: "Buat komponen Logo Cloud dengan field: judul section, koleksi logo (mediaMultiple), dan kecepatan animasi (number)." },
      { label: "Testimonial Card", prompt: "Buat komponen kartu testimoni dengan field: kutipan teks, nama pemberi, jabatan, dan foto profil." },
      { label: "CTA Block", prompt: "Buat komponen Call to Action dengan field: teks ajakan, deskripsi, warna background, teks tombol, dan link tujuan." },
      { label: "Steps/Process", prompt: "Buat komponen Langkah-langkah (Process Steps) dengan field: nomor urut (number), judul langkah, deskripsi singkat, dan ikon (media)." },
      { label: "Team Member", prompt: "Buat komponen Anggota Tim dengan field: nama lengkap, jabatan, foto profil (media), bio singkat, dan link social media (json)." },
      { label: "Gallery Item", prompt: "Buat komponen Item Galeri dengan field: gambar (media), caption, alt text, dan link tujuan (text)." },
      { label: "Tab Content", prompt: "Buat komponen Item Tab dengan field: label tab, judul konten, isi konten (rich text), dan gambar pendukung (media)." },
      { label: "Video Block", prompt: "Buat komponen Video Section dengan field: judul video, url video (youtube/vimeo), thumbnail (media), dan durasi video (text)." },
      { label: "Contact Info", prompt: "Buat komponen Info Kontak dengan field: tipe kontak (select: Alamat, Email, Telp, WA), nilai/value, dan ikon pendukung (media/text)." },
      { label: "Comparison Row", prompt: "Buat komponen Baris Perbandingan dengan field: nama fitur, deskripsi fitur, tersedia di Paket A (boolean), tersedia di Paket B (boolean), dan keterangan tambahan." },
      { label: "Banner Info", prompt: "Buat komponen Banner Pengumuman/Promo dengan field: teks promo, warna background (text), teks tombol, link tombol, dan status dapat ditutup (boolean)." },
      { label: "Card Versatile", prompt: "Buat komponen Kartu Serbaguna dengan field: judul, subtitle, deskripsi (textarea), gambar (media), teks link, dan orientasi (select: Horizontal, Vertical)." },
      { label: "Progress Bar", prompt: "Buat komponen Progress Bar dengan field: nama skill/item, persentase (number 0-100), warna bar (text), dan unit (text: e.g. % atau kg)." },
      { label: "Timeline Item", prompt: "Buat komponen Item Timeline dengan field: tahun/waktu (text), judul kejadian, deskripsi singkat (textarea), dan gambar pendukung (media)." },
      { label: "Breadcrumb Item", prompt: "Buat komponen Item Breadcrumb dengan field: label, link url, dan status aktif (boolean)." },
      { label: "Link Column", prompt: "Buat komponen Kolom Link Footer dengan field: judul kolom dan daftar link (json: label & url)." }
    ]
  }

  const currentTemplates = templates[type] || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border border-border shadow-none rounded-none max-h-[90vh] flex flex-col bg-card">
        <div className="bg-muted p-8 border-b border-border text-foreground shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-none bg-muted border border-border flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">AI {typeLabels[type]} Generator</DialogTitle>
              <DialogDescription className="text-muted-foreground font-medium">
                Describe what you want to build, and AI will architect the schema for you.
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-card overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Quick Start Templates
              </Label>
              <div className="flex flex-wrap gap-2">
                {currentTemplates.map((t) => (
                  <Button
                    key={t.label}
                    variant="outline"
                    size="sm"
                    onClick={() => setPrompt(t.prompt)}
                    className="rounded-none text-[10px] font-bold uppercase tracking-tight h-8 border border-border hover:border-orange-500 hover:bg-muted transition-colors"
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Custom Prompt / Description
              </Label>
              <Textarea
                placeholder={
                  type === "schema" 
                    ? "e.g., Create a Blog Post schema with title, rich text content, featured image, author name, and published date..."
                    : type === "single-type"
                    ? "e.g., A Landing Page configuration with hero title, subtitle, CTA text, and a primary color field..."
                    : "e.g., A pricing card component with plan name, price, list of features, and is_popular toggle..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px] bg-muted/30 border border-border rounded-none p-5 text-sm font-medium focus-visible:ring-orange-500"
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-none bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900 flex gap-3 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="text-xs font-bold leading-relaxed">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-none bg-muted/50 border border-border">
              <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-1">Architecture</p>
              <p className="text-[11px] text-muted-foreground leading-tight">AI will auto-generate fields, slugs, and data types.</p>
            </div>
            <div className="p-4 rounded-none bg-muted/50 border border-border">
              <p className="text-[10px] font-black uppercase text-orange-500 tracking-widest mb-1">Time Saver</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Generate complex structures in under 10 seconds.</p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-8 bg-muted/10 border-t border-border gap-3 shrink-0">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="rounded-none font-bold px-6 h-12 border border-border hover:bg-muted transition-colors"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={loading || !prompt}
            className="flex-1 rounded-none bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white border border-zinc-900 dark:border-zinc-100 font-black uppercase tracking-widest h-12 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Architecting...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-5 w-5" />
                Generate {typeLabels[type]}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
