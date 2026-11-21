---
name: sacms-global-website
description: Rencanakan dan bangun Website Template melalui SaCMS Global MCP, dari analisis brief dan workspace demo hingga skema CMS, frontend Next.js TypeScript dengan shadcn/ui, pemeriksaan keamanan, dan verifikasi deploy demo.
---

# SaCMS Global Website Agent

Gunakan skill ini untuk website demo atau Website Template yang dibangun melalui Global MCP. Untuk permintaan analisis saja, lakukan pekerjaan baca dan perencanaan. Untuk permintaan membangun demo, ikuti alur sampai pratinjau dapat diverifikasi.

Baca [alur kerja Global MCP](../../../src/lib/infrastructure/sacms-global-website-workflow.md). Jika skill dipakai dari luar repo, ambil panduan yang sama dengan `get_website_agent_workflow`. Gunakan `get_builder_guide` untuk kontrak tool dan `list_field_types` untuk kontrak data sebelum menulis skema atau fetch.

## Urutan kerja

1. **Analisis dan rencanakan.** Tentukan tujuan, pengguna, rute, kebutuhan data, dan kriteria penerimaan. Cari target di katalog. Bagi hasil kerja menjadi analisis, skema SaCMS, UI/UX, frontend, keamanan, dan rilis. Koordinator menyatukan hasil dan melakukan perubahan lewat MCP.
2. **Siapkan demo.** Gunakan workspace demo yang sudah terhubung dengan Schema Template yang dimaksud. Untuk website baru, panggil `create_schema_template` tanpa `schema` agar starter langsung dimuat. Verifikasi kemampuan tool dan keberadaan workspace.
3. **Baca dan sesuaikan skema.** Panggil `get_schema_template` dengan `includeDemoSchema: true`. Petakan Content Type, Single Type, Component, dan relasi dari skema aktual. Mulai dari bundel `schema` template agar data contoh ikut terbawa. Pertahankan Single Type dan Component. Keluarkan hanya Content Type yang tidak dibutuhkan setelah menyelesaikan relasinya. Untuk template baru, simpan dengan `expectedVersion` dan baca ulang skema demo. Untuk website yang sudah terhubung, validasi skema usulan dengan dry run dan rilis bersama perubahan frontend.
4. **Bangun frontend.** Setelah kontrak skema jelas, gunakan Next.js App Router, TypeScript, Tailwind, dan shadcn/ui sebagai default. Hubungkan setiap halaman ke data SaCMS sesuai kontrak Content API.
5. **Periksa keamanan, lalu deploy.** Periksa kredensial, batas workspace, validasi, sanitasi rich text, dan data contoh. Jalankan dry run, gunakan `schemaTemplateId` yang sama, dan verifikasi rute lewat `get_website_template_demo_status`. Publikasi katalog dan penggunaan di workspace pelanggan memerlukan otorisasi yang sesuai.

Jika MCP belum bisa membuat atau membaca skema demo, selesaikan analisis yang memungkinkan dan laporkan kemampuan yang belum tersedia. Syarat implementasi frontend adalah skema demo yang terverifikasi dan cocok dengan brief.
