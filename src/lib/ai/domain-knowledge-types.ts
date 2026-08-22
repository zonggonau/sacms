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
            { name: "Nama Kamar", slug: "name", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Tipe", slug: "type", type: "select", required: true },
            { name: "Harga per Malam", slug: "pricePerNight", type: "number", required: true },
            { name: "Kapasitas Tamu", slug: "capacity", type: "number", required: true },
            { name: "Foto Utama", slug: "coverImage", type: "media", required: true },
            { name: "Deskripsi", slug: "description", type: "richText", required: true },
            { name: "Fasilitas Kamar", slug: "amenities", type: "tags", required: false },
            { name: "Tersedia", slug: "isAvailable", type: "boolean", required: true }
          ],
          dummyData: [
            {
              name: "Ocean View Sunset Villa",
              slug: "ocean-view-sunset-villa",
              type: "Villa",
              pricePerNight: 2750000,
              capacity: 4,
              coverImage: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
              description: "<p>Villa mewah privat tepi pantai Teluk Cenderawasih dengan pemandangan sunset memukau dan kolam renang pribadi.</p>",
              amenities: ["Private Pool", "King Bed", "Ocean View", "Free Breakfast", "Jacuzzi"],
              isAvailable: true
            },
            {
              name: "Deluxe Tropical Suite",
              slug: "deluxe-tropical-suite",
              type: "Suite",
              pricePerNight: 1350000,
              capacity: 2,
              coverImage: "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
              description: "<p>Kamar suite elegan dengan balkon menghadap taman tropis dan akses langsung ke pantai pasir putih.</p>",
              amenities: ["King Bed", "Garden View", "Air Conditioning", "WiFi High Speed"],
              isAvailable: true
            }
          ]
        },
        {
          name: "Paket Wisata & Diving",
          slug: "tour-packages",
          description: "Paket tur wisata bahari, diving hiu paus Kwatisore, dan snorkeling",
          fields: [
            { name: "Nama Paket", slug: "title", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Durasi Hari", slug: "durationDays", type: "number", required: true },
            { name: "Harga Paket", slug: "price", type: "number", required: true },
            { name: "Foto Cover", slug: "image", type: "media", required: true },
            { name: "Highlight Wisata", slug: "highlights", type: "tags", required: false },
            { name: "Detail Rencana Perjalanan", slug: "itinerary", type: "richText", required: true }
          ],
          dummyData: [
            {
              title: "Whale Shark Kwatisore Safari (3D2N)",
              slug: "whale-shark-safari-3d2n",
              durationDays: 3,
              price: 4500000,
              image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
              highlights: ["Snorkeling Hiu Paus", "Bagan Kwatisore", "Sunset Cruise", "Dokumentasi Underwater"],
              itinerary: "<p>Pengalaman tak terlupakan berenang berdampingan dengan Hiu Paus raksasa jinak di perairan Teluk Cenderawasih.</p>"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Konfigurasi Beranda Resor",
          slug: "resort-homepage-config",
          description: "Pengaturan hero banner, video latar, kontak reservasi, dan alamat",
          fields: [
            { name: "Judul Hero", slug: "heroTitle", type: "text", required: true },
            { name: "Sub-judul Hero", slug: "heroSubtitle", type: "text", required: true },
            { name: "WhatsApp Reservasi", slug: "whatsappNumber", type: "text", required: true },
            { name: "Email Booking", slug: "bookingEmail", type: "text", required: true },
            { name: "Alamat Lengkap", slug: "resortAddress", type: "text", required: true }
          ],
          dummyData: {
            heroTitle: "Surga Tersembunyi di Pesisir Nabire Papua Tengah",
            heroSubtitle: "Nikmati ketenangan tropis autentik dengan fasilitas resor bintang lima dan keindahan alam bahari kelas dunia.",
            whatsappNumber: "+6281234567890",
            bookingEmail: "stay@nabireresort.com",
            resortAddress: "Jl. Pantai Bahari No. 18, Nabire, Papua Tengah"
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
            { name: "Nama Produk", slug: "name", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Kategori", slug: "category", type: "select", required: true },
            { name: "Harga Normal", slug: "price", type: "number", required: true },
            { name: "Harga Diskon", slug: "salePrice", type: "number", required: false },
            { name: "Stok Barang", slug: "stock", type: "number", required: true },
            { name: "Foto Produk", slug: "images", type: "media", required: true },
            { name: "Deskripsi Produk", slug: "description", type: "richText", required: true },
            { name: "Origin / Asal Daerah", slug: "origin", type: "text", required: false },
            { name: "Berat (Gram)", slug: "weightGrams", type: "number", required: true }
          ],
          dummyData: [
            {
              name: "Kopi Arabika Moanemani Dogiyai 250gr",
              slug: "kopi-arabika-moanemani-250g",
              category: "Kopi & Minuman",
              price: 95000,
              salePrice: 85000,
              stock: 50,
              images: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=1200&q=80",
              description: "<p>Kopi Arabika organik single-origin dipetik langsung dari pegunungan Dogiyai pada ketinggian 1.800 mdpl. Tasting notes: Floral, Citrusy, Brown Sugar.</p>",
              origin: "Dogiyai, Papua Tengah",
              weightGrams: 250
            },
            {
              name: "Noken Asli Serat Kulit Kayu Melinjo",
              slug: "noken-serat-kulit-kayu",
              category: "Kerajinan & Noken",
              price: 250000,
              stock: 15,
              images: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80",
              description: "<p>Tas tradisional warisan budaya UNESCO yang dirajut tangan oleh mama-mama pengrajin dengan pewarna alami akar kayu.</p>",
              origin: "Nabire, Papua Tengah",
              weightGrams: 300
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Pengaturan Toko",
          slug: "store-settings",
          description: "Informasi kontak admin, nomor WhatsApp order, dan rekening pembayaran",
          fields: [
            { name: "Nama Toko", slug: "storeName", type: "text", required: true },
            { name: "Nomor WhatsApp Order", slug: "whatsappOrderNumber", type: "text", required: true },
            { name: "Jam Operasional", slug: "operationalHours", type: "text", required: true },
            { name: "Pesan Sambutan Checkout", slug: "checkoutGreeting", type: "text", required: false }
          ],
          dummyData: {
            storeName: "Moanemani Specialty Coffee & Craft",
            whatsappOrderNumber: "+6282198765432",
            operationalHours: "Senin - Sabtu: 08:00 - 17:00 WIT",
            checkoutGreeting: "Halo admin, saya ingin memesan produk berikut dari katalog website:"
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
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Kategori", slug: "category", type: "select", required: true },
            { name: "Ringkasan Singkat", slug: "excerpt", type: "text", required: true },
            { name: "Konten Lengkap", slug: "content", type: "richText", required: true },
            { name: "Gambar Utama", slug: "featuredImage", type: "media", required: true },
            { name: "Nama Penulis", slug: "authorName", type: "text", required: true },
            { name: "Headline Utama", slug: "isHeadline", type: "boolean", required: true },
            { name: "Tag Berita", slug: "tags", type: "tags", required: false }
          ],
          dummyData: [
            {
              title: "Pemerintah Resmikan Kawasan Pusat Perekonomian Terpadu Nabire",
              slug: "peresmian-pusat-perekonomian-nabire",
              category: "Pembangunan & Ekonomi",
              excerpt: "Pusat perdagangan dan logistik modern mulai beroperasi untuk mempercepat perputaran ekonomi komoditas lokal.",
              content: "<p>Kawasan terpadu ini dilengkapi dengan fasilitas cold-storage hasil perikanan dan gudang penyimpanan kopi modern untuk memfasilitasi petani dan nelayan lokal.</p>",
              featuredImage: "https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?auto=format&fit=crop&w=1200&q=80",
              authorName: "Redaksi Media Papua",
              isHeadline: true,
              tags: ["Ekonomi", "Infrastruktur", "Nabire"]
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Konfigurasi Portal Media",
          slug: "media-portal-config",
          description: "Informasi redaksi, susunan dewan pers, dan kontak korespondensi",
          fields: [
            { name: "Nama Portal Media", slug: "portalName", type: "text", required: true },
            { name: "Slogan / Tagline", slug: "tagline", type: "text", required: true },
            { name: "Teks Pengumuman Berjalan", slug: "runningAnnouncement", type: "text", required: false }
          ],
          dummyData: {
            portalName: "Kabar Papua Tengah Digital",
            tagline: "Mengabarkan Kebenaran, Membangun Negeri",
            runningAnnouncement: "Selamat Datang di Portal Berita Resmi Kabupaten Nabire & Papua Tengah"
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
            { name: "Nama Dokter", slug: "name", type: "text", required: true },
            { name: "Spesialisasi", slug: "specialization", type: "text", required: true },
            { name: "Foto Profil", slug: "photo", type: "media", required: true },
            { name: "Jadwal Praktik", slug: "schedule", type: "text", required: true },
            { name: "Biaya Konsultasi", slug: "consultationFee", type: "number", required: false }
          ],
          dummyData: [
            {
              name: "dr. Yohanes Pigome, Sp.A",
              specialization: "Spesialis Anak & Tumbuh Kembang",
              photo: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1200&q=80",
              schedule: "Senin - Kamis: 16:00 - 20:00 WIT",
              consultationFee: 200000
            }
          ]
        },
        {
          name: "Layanan Medis & Fasilitas",
          slug: "services",
          description: "Daftar layanan poliklinik, laboratorium, dan radiologi",
          fields: [
            { name: "Nama Layanan", slug: "title", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Deskripsi Layanan", slug: "description", type: "richText", required: true },
            { name: "Foto Fasilitas", slug: "image", type: "media", required: true }
          ],
          dummyData: [
            {
              title: "Laboratorium Patologi & USG 4D",
              slug: "laboratorium-usg",
              description: "<p>Layanan diagnostik komprehensif didukung teknologi termutakhir untuk akurasi pemeriksaan medis.</p>",
              image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Profil & IGD Darurat",
          slug: "clinic-profile",
          description: "Nomor darurat 24 jam, ambulans, dan lokasi klinik",
          fields: [
            { name: "Hotline Darurat 24 Jam", slug: "emergencyHotline", type: "text", required: true },
            { name: "Alamat Klinik", slug: "clinicAddress", type: "text", required: true }
          ],
          dummyData: {
            emergencyHotline: "(0984) 21118 / +628114889900",
            clinicAddress: "Jl. Merdeka No. 45, Nabire, Papua Tengah"
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
            { name: "Nama Jurusan", slug: "name", type: "text", required: true },
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Deskripsi Singkat", slug: "shortDesc", type: "text", required: true },
            { name: "Foto Laboratorium", slug: "photo", type: "media", required: true },
            { name: "Kompetensi Utama", slug: "skills", type: "tags", required: false }
          ],
          dummyData: [
            {
              name: "Teknik Jaringan Komputer & Telekomunikasi (TJKT)",
              slug: "tjkt",
              shortDesc: "Mempelajari instalasi fiber optic, konfigurasi server cloud, dan keamanan siber.",
              photo: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80",
              skills: ["Fiber Optic", "MikroTik Routing", "Linux Server", "Cloud Computing"]
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Informasi PPDB Online",
          slug: "ppdb-info",
          description: "Jadwal pendaftaran, syarat berkas, dan nomor helpdesk PPDB",
          fields: [
            { name: "Status Pendaftaran", slug: "registrationStatus", type: "text", required: true },
            { name: "Link Formulir Online", slug: "registrationFormUrl", type: "text", required: false },
            { name: "Kontak Panitia PPDB", slug: "ppdbContact", type: "text", required: true }
          ],
          dummyData: {
            registrationStatus: "Pendaftaran Gelombang 1 Dibuka (1 Juni - 15 Juli)",
            registrationFormUrl: "/ppdb/daftar",
            ppdbContact: "0812-4000-8899 (Pak Guru Robert)"
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
            { name: "Slug", slug: "slug", type: "slug", required: true, unique: true },
            { name: "Nama Klien", slug: "client", type: "text", required: true },
            { name: "Kategori Bidang", slug: "category", type: "text", required: true },
            { name: "Mockup Cover", slug: "coverImage", type: "media", required: true },
            { name: "Hasil Kunci", slug: "results", type: "text", required: true },
            { name: "Testimoni Klien", slug: "testimonial", type: "richText", required: false }
          ],
          dummyData: [
            {
              title: "Redesign Ekosistem Digital Papua Tourism Board",
              slug: "redesign-papua-tourism",
              client: "Dinas Pariwisata",
              category: "Web App & Branding",
              coverImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80",
              results: "+340% Kenaikan Reservasi Wisata Mancanegara",
              testimonial: "<p>Karya tim agensi luar biasa transformatif, menghadirkan estetika budaya Papua dalam pengalaman digital kelas satu.</p>"
            }
          ]
        }
      ],
      singleTypes: [
        {
          name: "Profil Agensi",
          slug: "agency-profile",
          description: "Misi agensi, statistik pencapaian, dan kontak bisnis",
          fields: [
            { name: "Nama Agensi", slug: "agencyName", type: "text", required: true },
            { name: "Tagline Utama", slug: "heroTagline", type: "text", required: true },
            { name: "Email Bisnis", slug: "businessEmail", type: "text", required: true }
          ],
          dummyData: {
            agencyName: "Cenderawasih Digital Studio",
            heroTagline: "Mentransformasi Ide Menjadi Pengalaman Digital Bernilai Tinggi",
            businessEmail: "hello@cenderawasih.studio"
          }
        }
      ],
      components: []
    }
  }
]
