export interface DomainBlueprint {
  id: string
  name: string
  category: string
  icon: string
  description: string
  prompt: string
  frontendPrompt: string
  schema: {
    contentTypes: {
      name: string
      slug: string
      description: string
      fields: {
        name: string
        slug: string
        type: string
        required: boolean
        unique?: boolean
        relationSlug?: string
        componentSlug?: string
      }[]
      dummyData: Record<string, any>[]
    }[]
    singleTypes: {
      name: string
      slug: string
      description: string
      fields: {
        name: string
        slug: string
        type: string
        required: boolean
      }[]
      dummyData: Record<string, any>
    }[]
    components: {
      name: string
      slug: string
      category: string
      fields: {
        name: string
        slug: string
        type: string
        required: boolean
      }[]
    }[]
  }
}

export const DOMAIN_KNOWLEDGE_LIBRARY: DomainBlueprint[] = [
  {
    id: "pariwisata-resor",
    name: "Resor & Pariwisata",
    category: "Pariwisata & Hospitaliti",
    icon: "🏖️",
    description: "Katalog kamar penginapan, paket wisata bahari, fasilitas resort, galeri foto, dan reservasi booking.",
    prompt: "Buat website modern untuk Grand Resort & Pariwisata dengan katalog kamar, paket wisata bahari, fasilitas resto seafood, dan formulir booking.",
    frontendPrompt: "Website resor & pariwisata modern bernuansa tropis mewah dengan hero booking widget, kartu kamar suite/villa, showcase wisata bahari, dan form reservasi interaktif.",
    schema: {
      contentTypes: [
        {
          name: "Kamar & Villa",
          slug: "rooms",
          description: "Daftar tipe kamar, fasilitas kamar, kapasitas, dan harga per malam",
          fields: [
            { name: "Judul Kamar", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Tipe", slug: "subtitle", type: "text", required: true },
            { name: "Harga per Malam", slug: "price", type: "number", required: true },
            { name: "Kapasitas Tamu", slug: "capacity", type: "number", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Deskripsi Lengkap", slug: "content", type: "richText", required: true },
            { name: "Fasilitas Kamar", slug: "amenities", type: "tags", required: false },
            { name: "Tersedia", slug: "is_available", type: "boolean", required: true }
          ],
          dummyData: [
            {
              title: "Ocean View Sunset Villa",
              slug: "ocean-view-sunset-villa",
              subtitle: "Villa Eksklusif Tepi Pantai",
              price: 2750000,
              capacity: 4,
              cover_image: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Villa mewah privat tepi pantai Teluk Cenderawasih dengan pemandangan sunset memukau dan kolam renang pribadi.</p>",
              amenities: ["Private Pool", "King Bed", "Ocean View", "Free Breakfast", "Jacuzzi"],
              is_available: true
            },
            {
              title: "Deluxe Tropical Suite",
              slug: "deluxe-tropical-suite",
              subtitle: "Kamar Suite Nuansa Tropis",
              price: 1350000,
              capacity: 2,
              cover_image: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Kamar suite elegan dengan balkon menghadap taman tropis dan akses langsung ke pantai pasir putih.</p>",
              amenities: ["King Bed", "Garden View", "Air Conditioning", "WiFi High Speed"],
              is_available: true
            }
          ]
        },
        {
          name: "Paket Wisata & Diving",
          slug: "tour-packages",
          description: "Paket tur wisata bahari, diving hiu paus Kwatisore, dan snorkeling",
          fields: [
            { name: "Judul Paket", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Durasi", slug: "subtitle", type: "text", required: true },
            { name: "Harga Paket", slug: "price", type: "number", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Highlight Wisata", slug: "highlights", type: "tags", required: false },
            { name: "Detail Rencana Perjalanan", slug: "content", type: "richText", required: true }
          ],
          dummyData: [
            {
              title: "Whale Shark Kwatisore Safari (3D2N)",
              slug: "whale-shark-safari-3d2n",
              subtitle: "Petualangan Snorkeling Bersama Hiu Paus",
              price: 4500000,
              cover_image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
              highlights: ["Snorkeling Hiu Paus", "Bagan Kwatisore", "Sunset Cruise", "Dokumentasi Underwater"],
              content: "<p>Pengalaman tak terlupakan berenang berdampingan dengan Hiu Paus raksasa jinak di perairan Teluk Cenderawasih.</p>"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Konfigurasi Beranda Resor",
          slug: "resort-settings",
          description: "Pengaturan hero banner, kontak reservasi, dan alamat",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Deskripsi Tentang Kami", slug: "content", type: "richText", required: true },
            { name: "Nomor WhatsApp", slug: "whatsapp", type: "text", required: true },
            { name: "Email Booking", slug: "email", type: "text", required: true },
            { name: "Alamat Lengkap", slug: "address", type: "text", required: true }
          ],
          dummyData: {
            hero_title: "Surga Tersembunyi di Pesisir Nabire Papua Tengah",
            hero_subtitle: "Nikmati ketenangan tropis autentik dengan fasilitas resor bintang lima dan keindahan alam bahari kelas dunia.",
            content: "<p>Grand Resort & Villas menghadirkan akomodasi premium dengan pemandangan langsung ke pesisir Teluk Cenderawasih yang mempesona.</p>",
            whatsapp: "+6281234567890",
            email: "stay@nabireresort.com",
            address: "Jl. Pantai Bahari No. 18, Nabire, Papua Tengah"
          }
        }
      ],
      components: []
    }
  },
  {
    id: "umkm-ecommerce",
    name: "Toko Online & UMKM Kopi",
    category: "E-Commerce & UMKM",
    icon: "☕",
    description: "Katalog produk Kopi Moanemani, Noken kulit kayu, batik khas, manajemen varian, dan keranjang belanja.",
    prompt: "Buat sistem toko online e-commerce untuk UMKM Khas Papua (Kopi Arabika Moanemani & Noken Kulit Kayu) dengan katalog produk, varian berat, rating ulasan, dan WhatsApp checkout.",
    frontendPrompt: "Website e-commerce modern bernuansa earth-tone hangat dengan grid katalog produk filterable, badge best seller, kalkulator ongkir/diskon, dan keranjang belanja WhatsApp instan.",
    schema: {
      contentTypes: [
        {
          name: "Produk UMKM",
          slug: "products",
          description: "Katalog produk kerajinan dan komoditas unggulan",
          fields: [
            { name: "Judul Produk", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Asal Daerah", slug: "subtitle", type: "text", required: false },
            { name: "Kategori", slug: "category", type: "select", required: true },
            { name: "Harga Normal", slug: "price", type: "number", required: true },
            { name: "Harga Diskon", slug: "sale_price", type: "number", required: false },
            { name: "Stok Barang", slug: "stock", type: "number", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Deskripsi Produk", slug: "content", type: "richText", required: true },
            { name: "Berat (Gram)", slug: "weight_grams", type: "number", required: true }
          ],
          dummyData: [
            {
              title: "Kopi Arabika Moanemani Dogiyai 250gr",
              slug: "kopi-arabika-moanemani-250g",
              subtitle: "Dogiyai, Papua Tengah (1.800 mdpl)",
              category: "Kopi & Minuman",
              price: 95000,
              sale_price: 85000,
              stock: 50,
              cover_image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Kopi Arabika organik single-origin dipetik langsung dari pegunungan Dogiyai pada ketinggian 1.800 mdpl. Tasting notes: Floral, Citrusy, Brown Sugar.</p>",
              weight_grams: 250
            },
            {
              title: "Noken Asli Serat Kulit Kayu Melinjo",
              slug: "noken-serat-kulit-kayu",
              subtitle: "Kerajinan Asli Mama Papua",
              category: "Kerajinan & Noken",
              price: 250000,
              stock: 15,
              cover_image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Tas tradisional warisan budaya UNESCO yang dirajut tangan oleh mama-mama pengrajin dengan pewarna alami akar kayu.</p>",
              weight_grams: 300
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Pengaturan Toko",
          slug: "store-settings",
          description: "Informasi kontak admin, nomor WhatsApp order, dan profil toko",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Deskripsi Toko", slug: "content", type: "richText", required: true },
            { name: "Nomor WhatsApp Order", slug: "whatsapp", type: "text", required: true },
            { name: "Email Toko", slug: "email", type: "text", required: true },
            { name: "Jam Operasional", slug: "operational_hours", type: "text", required: true }
          ],
          dummyData: {
            hero_title: "Moanemani Specialty Coffee & Craft Store",
            hero_subtitle: "Koleksi Produk Otentik & Kopi Organik Pilihan Langsung dari Petani Papua Tengah",
            content: "<p>Menghadirkan kelezatan kopi single-origin dan kerajinan noken warisan budaya asli Papua Tengah ke seluruh nusantara.</p>",
            whatsapp: "+6282198765432",
            email: "cs@moanemanicoffee.com",
            operational_hours: "Senin - Sabtu: 08:00 - 17:00 WIT"
          }
        }
      ],
      components: []
    }
  },
  {
    id: "portal-berita-pemerintah",
    name: "Portal Berita & Media Informasi",
    category: "Publikasi & Media",
    icon: "📰",
    description: "Portal berita digital, kategori topik, profil jurnalis, artikel unggulan, dan pengumuman publik.",
    prompt: "Rancang portal berita digital dan publikasi informasi publik dengan kategori berita (Politik, Ekonomi, Budaya, Daerah), artikel kaya teks, liputan utama, dan banner pengumuman resmi.",
    frontendPrompt: "Website portal media berita profesional modern dengan grid breaking news headline, feed artikel terpopuler, switcher dark/light mode elegan, dan filter kategori responsif.",
    schema: {
      contentTypes: [
        {
          name: "Artikel Berita",
          slug: "articles",
          description: "Daftar artikel berita, liputan khusus, dan siaran pers",
          fields: [
            { name: "Judul Berita", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Ringkasan", slug: "subtitle", type: "text", required: true },
            { name: "Kategori", slug: "category", type: "select", required: true },
            { name: "Isi Konten Lengkap", slug: "content", type: "richText", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Nama Penulis", slug: "author", type: "text", required: true },
            { name: "Headline Utama", slug: "is_headline", type: "boolean", required: true },
            { name: "Tag Berita", slug: "tags", type: "tags", required: false }
          ],
          dummyData: [
            {
              title: "Pemerintah Resmikan Kawasan Pusat Perekonomian Terpadu Nabire",
              slug: "peresmian-pusat-perekonomian-nabire",
              subtitle: "Percepatan Perputaran Ekonomi Komoditas Lokal Papua Tengah",
              category: "Pembangunan & Ekonomi",
              content: "<p>Kawasan terpadu ini dilengkapi dengan fasilitas cold-storage hasil perikanan dan gudang penyimpanan kopi modern untuk memfasilitasi petani dan nelayan lokal.</p>",
              cover_image: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80",
              author: "Redaksi Media Papua",
              is_headline: true,
              tags: ["Ekonomi", "Infrastruktur", "Nabire"]
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Konfigurasi Portal Media",
          slug: "media-settings",
          description: "Informasi redaksi, susunan dewan pers, dan kontak korespondensi",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Deskripsi Portal", slug: "content", type: "richText", required: true },
            { name: "Nomor WhatsApp Redaksi", slug: "whatsapp", type: "text", required: true },
            { name: "Email Redaksi", slug: "email", type: "text", required: true },
            { name: "Teks Pengumuman", slug: "running_announcement", type: "text", required: false }
          ],
          dummyData: {
            hero_title: "Kabar Papua Tengah Digital",
            hero_subtitle: "Portal Berita Terpercaya Mengabarkan Kebenaran dan Pembangunan Daerah",
            content: "<p>Media informasi publik digital independen yang menyajikan berita faktual, tajam, dan berimbang seputar Papua Tengah.</p>",
            whatsapp: "+628114445566",
            email: "redaksi@kabarpapua.id",
            running_announcement: "Selamat Datang di Portal Berita Resmi Kabupaten Nabire & Papua Tengah"
          }
        }
      ],
      components: []
    }
  },
  {
    id: "kesehatan-klinik",
    name: "Klinik & Layanan Kesehatan",
    category: "Kesehatan",
    icon: "🏥",
    description: "Profil fasilitas kesehatan, jadwal praktik dokter spesialis, daftar layanan medis, dan form pendaftaran online.",
    prompt: "Buat website profil klinik kesehatan modern dengan jadwal praktik dokter, katalog poliklinik/layanan medis, artikel kesehatan, dan formulir pendaftaran janji temu pasien.",
    frontendPrompt: "Website klinik medis bersih, terpercaya bernuansa biru medis & putih bersih, dengan widget cari jadwal dokter, daftar poli spesialis, dan form pendaftaran konsultasi instan.",
    schema: {
      contentTypes: [
        {
          name: "Dokter Spesialis",
          slug: "doctors",
          description: "Daftar dokter spesialis, kualifikasi, dan jadwal poli",
          fields: [
            { name: "Nama Dokter", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Spesialisasi", slug: "subtitle", type: "text", required: true },
            { name: "Foto Profil", slug: "cover_image", type: "media", required: true },
            { name: "Jadwal Praktik", slug: "schedule", type: "text", required: true },
            { name: "Profil Lengkap", slug: "content", type: "richText", required: false },
            { name: "Biaya Konsultasi", slug: "price", type: "number", required: false }
          ],
          dummyData: [
            {
              title: "dr. Yohanes Pigome, Sp.A",
              slug: "dr-yohanes-pigome-spa",
              subtitle: "Spesialis Anak & Tumbuh Kembang",
              cover_image: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80",
              schedule: "Senin - Kamis: 16:00 - 20:00 WIT",
              content: "<p>Dokter spesialis anak berpengalaman lebih dari 10 tahun melayani kesehatan balita dan anak-anak.</p>",
              price: 200000
            }
          ]
        },
        {
          name: "Layanan Medis & Fasilitas",
          slug: "services",
          description: "Daftar layanan poliklinik, laboratorium, dan radiologi",
          fields: [
            { name: "Judul Layanan", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul Layanan", slug: "subtitle", type: "text", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Deskripsi Layanan", slug: "content", type: "richText", required: true }
          ],
          dummyData: [
            {
              title: "Laboratorium Patologi & USG 4D",
              slug: "laboratorium-usg",
              subtitle: "Layanan Diagnostik Akurat 24 Jam",
              cover_image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Layanan diagnostik komprehensif didukung teknologi termutakhir untuk akurasi pemeriksaan medis.</p>"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Profil & Kontak Klinik",
          slug: "clinic-settings",
          description: "Nomor darurat 24 jam, ambulans, dan lokasi klinik",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Deskripsi Klinik", slug: "content", type: "richText", required: true },
            { name: "Hotline WhatsApp / Darurat", slug: "whatsapp", type: "text", required: true },
            { name: "Email Informasi", slug: "email", type: "text", required: true },
            { name: "Alamat Klinik", slug: "address", type: "text", required: true }
          ],
          dummyData: {
            hero_title: "Klinik Pratama & Bersalin Nabire Sehat",
            hero_subtitle: "Pelayanan Kesehatan Profesional, Ramah, dan Terpercaya untuk Seluruh Keluarga",
            content: "<p>Menyediakan layanan medis rawat jalan, persalinan 24 jam, apotek terpadu, dan laboratorium modern.</p>",
            whatsapp: "+628114889900",
            email: "info@nabiresehat.com",
            address: "Jl. Merdeka No. 45, Nabire, Papua Tengah"
          }
        }
      ],
      components: []
    }
  },
  {
    id: "pendidikan-sekolah",
    name: "Sekolah & Lembaga Pendidikan",
    category: "Pendidikan",
    icon: "🎓",
    description: "Profil institusi, program keahlian/jurusan, pengumuman akademik, profil guru, dan portal PPDB online.",
    prompt: "Rancang website institusi sekolah / SMK dengan direktori jurusan/program keahlian, pengumuman kalender akademik, galeri prestasi siswa, dan formulir pendaftaran PPDB online.",
    frontendPrompt: "Website institusi pendidikan modern energetik dan berwibawa dengan hero selamat datang kepala sekolah, kartu program jurusan unggulan, showcase prestasi, dan tombol portal PPDB.",
    schema: {
      contentTypes: [
        {
          name: "Program Keahlian & Jurusan",
          slug: "majors",
          description: "Daftar jurusan kejuruan, kurikulum, dan prospek kerja",
          fields: [
            { name: "Judul Jurusan", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Kode Jurusan", slug: "subtitle", type: "text", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Deskripsi Kurikulum", slug: "content", type: "richText", required: true },
            { name: "Kompetensi Utama", slug: "skills", type: "tags", required: false }
          ],
          dummyData: [
            {
              title: "Teknik Jaringan Komputer & Telekomunikasi",
              slug: "tjkt",
              subtitle: "Program Keahlian TJKT (Akreditasi A)",
              cover_image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
              content: "<p>Mempelajari instalasi fiber optic, konfigurasi server cloud, dan keamanan siber berstandar industri internasional.</p>",
              skills: ["Fiber Optic", "MikroTik Routing", "Linux Server", "Cloud Computing"]
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Konfigurasi Profil Sekolah",
          slug: "school-settings",
          description: "Jadwal pendaftaran, syarat berkas, dan nomor helpdesk PPDB",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Sambutan Kepala Sekolah", slug: "content", type: "richText", required: true },
            { name: "Nomor WhatsApp Helpdesk", slug: "whatsapp", type: "text", required: true },
            { name: "Email Resmi Sekolah", slug: "email", type: "text", required: true },
            { name: "Alamat Kampus", slug: "address", type: "text", required: true }
          ],
          dummyData: {
            hero_title: "SMK Negeri 1 Teknologi & Bisnis Nabire",
            hero_subtitle: "Mencetak Generasi Unggul, Berkarakter, dan Siap Kerja di Era Digital Global",
            content: "<p>Selamat datang di portal resmi SMK Negeri 1 Nabire. Kami berkomitmen menyelenggarakan pendidikan vokasi berkualitas unggul.</p>",
            whatsapp: "+6281240008899",
            email: "info@smkn1nabire.sch.id",
            address: "Jl. Pendidikan No. 10, Nabire, Papua Tengah"
          }
        }
      ],
      components: []
    }
  },
  {
    id: "portofolio-agency",
    name: "Agensi Kreatif & Portofolio",
    category: "Bisnis & Kreatif",
    icon: "💼",
    description: "Showcase studi kasus proyek, paket layanan digital marketing/branding, testimoni klien, dan formulir konsultasi.",
    prompt: "Buat website portofolio agensi digital kreatif berkelas dunia dengan showcase studi kasus proyek (Web, App, Branding), testimoni klien, paket pricing, dan formulir estimasi proyek.",
    frontendPrompt: "Website agensi ultra-modern sleek dark mode dengan tipografi tegas, kartu studi kasus interaktif, counter statistik pencapaian, dan CTA kontak formulir proyek futuristik.",
    schema: {
      contentTypes: [
        {
          name: "Studi Kasus Proyek",
          slug: "projects",
          description: "Showcase hasil karya klien, hasil metrik, dan testimoni",
          fields: [
            { name: "Judul Proyek", slug: "title", type: "text", required: true },
            { name: "Slug URL", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Sub-judul / Kategori", slug: "subtitle", type: "text", required: true },
            { name: "Nama Klien", slug: "client", type: "text", required: true },
            { name: "Foto Cover", slug: "cover_image", type: "media", required: true },
            { name: "Hasil Kunci", slug: "results", type: "text", required: true },
            { name: "Detail Studi Kasus", slug: "content", type: "richText", required: true }
          ],
          dummyData: [
            {
              title: "Redesign Ekosistem Digital Papua Tourism Board",
              slug: "redesign-papua-tourism",
              subtitle: "Web App, Branding & Digital Marketing",
              client: "Dinas Pariwisata Papua",
              cover_image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
              results: "+340% Kenaikan Reservasi Wisata Mancanegara",
              content: "<p>Karya transformatif yang menghadirkan estetika budaya Papua dalam pengalaman digital kelas satu dengan performa tinggi.</p>"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Profil Agensi & Kontak",
          slug: "agency-settings",
          description: "Misi agensi, statistik pencapaian, dan kontak bisnis",
          fields: [
            { name: "Judul Utama (Hero Title)", slug: "hero_title", type: "text", required: true },
            { name: "Sub-judul (Hero Subtitle)", slug: "hero_subtitle", type: "text", required: true },
            { name: "Tentang Agensi", slug: "content", type: "richText", required: true },
            { name: "Nomor WhatsApp Bisnis", slug: "whatsapp", type: "text", required: true },
            { name: "Email Bisnis", slug: "email", type: "text", required: true },
            { name: "Alamat Studio", slug: "address", type: "text", required: true }
          ],
          dummyData: {
            hero_title: "Cenderawasih Digital Creative Studio",
            hero_subtitle: "Mentransformasi Ide Menjadi Pengalaman Digital Bernilai Tinggi dan Berdampak Global",
            content: "<p>Kami adalah studio agensi kreatif yang mengkhususkan diri pada pengembangan website modern, desain UI/UX, dan strategi branding terpadu.</p>",
            whatsapp: "+6281122334455",
            email: "hello@cenderawasih.studio",
            address: "Cyber Building Lt. 4, Nabire, Papua Tengah"
          }
        }
      ],
      components: []
    }
  }
]
