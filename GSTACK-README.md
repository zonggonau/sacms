# Panduan Penggunaan gstack

gstack adalah kumpulan *skill* (slash command) untuk Claude Code yang bekerja seperti satu tim engineering virtual: ada "CEO" yang menantang ide produk, "engineering manager" yang mengunci arsitektur, "designer", "reviewer", "QA" yang membuka browser sungguhan, dan "release engineer" yang membuat Pull Request.

- Repo resmi: https://github.com/garrytan/gstack
- Lokasi instalasi di komputer ini: `C:\Users\nau\.claude\skills\gstack` (di Git Bash: `~/.claude/skills/gstack`)
- Versi terpasang: 1.103.0.0 (channel update: `stable`)

> **Catatan jujur dari pembuatnya:** gstack tidak membuat Claude memperbaiki bug lebih banyak. Dalam uji coba mereka, tingkat keberhasilan memperbaiki bug hampir sama dengan atau tanpa gstack. Nilai gstack ada pada **alur kerja yang terstruktur, review, langkah shipping, dan pengaman** (safety guard), bukan pada kecerdasan tambahan.

---

## 1. Mulai cepat (4 langkah)

Ketik perintah ini langsung di chat Claude Code:

| Langkah | Perintah | Hasilnya |
|---|---|---|
| 1 | `/office-hours` | Ceritakan apa yang mau Anda bangun. Claude akan menantang asumsi Anda, menawarkan beberapa pendekatan, lalu menulis *design doc* yang dibaca oleh skill lain. |
| 2 | `/review` | Membaca perubahan kode (diff) Anda dan mencari bug yang biasanya lolos dari test. Yang jelas diperbaiki otomatis, sisanya ditanyakan ke Anda. |
| 3 | `/qa <url>` | Membuka browser sungguhan ke URL (misalnya `http://localhost:3000`), mencoba alur aplikasi, menemukan bug, dan memperbaikinya. |
| 4 | `/ship` | Menjalankan test, review, menaikkan versi/CHANGELOG, push, dan membuat Pull Request. |

Kalau belum yakin skill mana yang cocok, cukup jelaskan kebutuhan Anda dengan bahasa biasa. gstack akan memberi petunjuk satu baris berisi skill yang sesuai (fitur *skill routing*). Anda juga bisa mengetik `/gstack` untuk minta dipilihkan.

> **Penting:** `/review`, `/ship`, `/land-and-deploy`, dan `/retro` bekerja berdasarkan **git** (diff, branch, PR). Folder `d:\SaCMS Global` saat ini **belum** berupa repository git, jadi jalankan `git init` dulu (atau buka folder project yang sudah memakai git) sebelum memakai skill-skill tersebut.

---

## 2. Alur kerja lengkap (satu "sprint")

gstack dirancang sebagai sebuah proses. Tiap skill membaca hasil dari skill sebelumnya:

```
Think  →  Plan  →  Build  →  Review  →  Test  →  Ship  →  Reflect
```

Contoh percakapan dari awal sampai akhir:

```
Anda:   Saya ingin membuat aplikasi ringkasan jadwal harian dari kalender.
Anda:   /office-hours
        → Claude bertanya soal masalah nyata Anda, lalu menulis design doc.

Anda:   /plan-ceo-review
        → Menantang cakupan (scope): perlu diperbesar atau diperkecil?

Anda:   /plan-eng-review
        → Diagram alur data, edge case, rencana test, risiko keamanan.

Anda:   Setujui rencananya, mulai kerjakan.
        → Claude menulis kodenya.

Anda:   /review
        → Bug yang jelas diperbaiki otomatis, yang meragukan ditanyakan.

Anda:   /qa http://localhost:3000
        → Membuka browser, mengklik alur aplikasi, memperbaiki bug.

Anda:   /ship
        → Test, review final, lalu push dan membuat PR.

Anda:   /retro
        → Retrospektif mingguan: apa yang sudah dikirim, kondisi test, dll.
```

Kalau ingin semua review rencana dijalankan sekaligus, pakai **`/autoplan`**. Perintah ini menjalankan review CEO → desain → DX → engineering secara berurutan, dan hanya menanyakan keputusan yang menyangkut selera Anda.

---

## 3. Daftar perintah berdasarkan kebutuhan

### Ide dan perencanaan (sebelum menulis kode)

| Perintah | Kegunaan |
|---|---|
| `/office-hours` | **Mulai dari sini.** Menguji ide produk dengan pertanyaan tajam ala YC dan menghasilkan design doc. |
| `/plan-ceo-review` | Memikirkan ulang produk: memperluas, mempertahankan, atau mengurangi cakupan. |
| `/plan-eng-review` | Mengunci arsitektur, alur data, edge case, dan rencana test. |
| `/plan-design-review` | Menilai tiap aspek desain dari 0 sampai 10, lalu memperbaiki rencananya. |
| `/plan-devex-review` | Review pengalaman developer (untuk API, CLI, SDK, dokumentasi). |
| `/autoplan` | Menjalankan semua review di atas secara otomatis. |
| `/spec` | Mengubah ide yang masih kabur menjadi spesifikasi atau issue yang jelas. |

### Desain

| Perintah | Kegunaan |
|---|---|
| `/design-consultation` | Menyusun design system lengkap (warna, tipografi, spacing) dan menulis `DESIGN.md`. |
| `/design-shotgun` | Membuat 4 sampai 6 variasi mockup untuk dibandingkan, lalu diulang sampai cocok. |
| `/design-html` | Mengubah mockup yang sudah disetujui menjadi HTML/CSS siap pakai. |
| `/design-review` | Audit visual pada aplikasi yang sedang berjalan, lalu memperbaiki temuannya. |
| `/design-motion` | Membuat animasi showcase (MP4/GIF). Perlu `ffmpeg`. |

### Review dan kualitas kode

| Perintah | Kegunaan |
|---|---|
| `/review` | Review diff sebelum di-merge: race condition, N+1 query, celah keamanan, dan sejenisnya. |
| `/build-check` | Menjalankan typecheck, lint, build, dan test, lalu memperbaiki yang gagal sampai semuanya hijau. |
| `/health` | Dashboard kualitas kode. |
| `/test-audit` | Mencari test yang duplikat atau tidak berguna. |
| `/deslop-shared-libs` | Mencari kode yang layak diekstrak menjadi library bersama. |
| `/cso` | Audit keamanan (OWASP + STRIDE). **Belum aktif di komputer ini** (lihat bagian 6). |

### Testing (QA)

| Perintah | Kegunaan |
|---|---|
| `/qa <url>` | Menguji web, API, CLI, atau webhook, lalu **memperbaiki** bug yang ditemukan. |
| `/qa-only <url>` | Sama seperti `/qa`, tetapi hanya **melaporkan** tanpa mengubah kode. |
| `/browse` | Memberi Claude "mata": membuka halaman, mengklik, mengambil screenshot, dan membaca console error. |
| `/benchmark` | Mengukur kecepatan halaman (Core Web Vitals) sebelum dan sesudah perubahan. |
| `/devex-review` | Menguji langsung alur onboarding atau dokumentasi untuk developer. |

### Rilis dan deploy

| Perintah | Kegunaan |
|---|---|
| `/ship` | Test, review, menaikkan versi, push, dan membuat PR. |
| `/setup-deploy` | Setup sekali untuk mendeteksi platform deploy, URL produksi, dan perintah deploy. |
| `/land-and-deploy` | Merge PR, menunggu CI dan deploy, lalu mengecek kesehatan produksi. |
| `/canary` | Memantau error dan performa setelah deploy. |
| `/document-release` | Mengecek apakah dokumentasi sudah sesuai dengan perubahan yang dirilis. |
| `/document-generate` | Menulis dokumentasi yang belum ada dari nol. |

### Lain-lain yang berguna

| Perintah | Kegunaan |
|---|---|
| `/retro` | Retrospektif mingguan. `/retro global` merangkum semua project. |
| `/context-save` / `/context-restore` | Menyimpan progres kerja lalu melanjutkannya di sesi berikutnya. |
| `/learn` | Melihat atau mengelola hal yang sudah "dipelajari" gstack tentang project Anda. |
| `/make-pdf` | Mengubah file Markdown menjadi PDF rapi (juga bisa ke HTML atau DOCX). |
| `/diagram` | Mengubah deskripsi teks menjadi diagram (Mermaid, Excalidraw, SVG, PNG). |
| `/scrape` | Mengambil data terstruktur (tabel, daftar, harga) dari halaman web. |
| `/setup-browser-cookies` | Menyalin cookie login dari Chrome/Edge ke browser gstack supaya bisa menguji halaman yang butuh login. |
| `/open-gstack-browser` | Membuka browser gstack dalam mode terlihat (headed) supaya Anda bisa melihat apa yang dikerjakan Claude. |

---

## 4. Pengaman (safety)

| Perintah | Kegunaan |
|---|---|
| `/careful` | Memberi peringatan sebelum perintah berbahaya (`rm -rf`, `DROP TABLE`, force-push). **Sudah aktif otomatis di setiap sesi.** |
| `/freeze <folder>` | Mengunci agar Claude hanya boleh mengedit file di satu folder. Cocok saat debugging. |
| `/unfreeze` | Membuka kembali kunci `/freeze`. |
| `/guard` | `/careful` dan `/freeze` sekaligus. Gunakan saat bekerja di server produksi. |

---

## 5. Hook yang aktif dan cara mengaturnya

Saat instalasi, gstack menambahkan beberapa *hook* ke `~/.claude/settings.json`:

| Fitur | Fungsi | Nama setting |
|---|---|---|
| Skill routing | Petunjuk satu baris berisi skill gstack yang cocok dengan prompt Anda | `skill_routing` |
| Skill contracts | Skill yang belum menyelesaikan langkah wajibnya ditahan sekali sebelum berhenti | `skill_contracts` |
| Destructive guard | Meminta konfirmasi sebelum menjalankan perintah berbahaya | `destructive_guard` |
| Timeline stop | Mencatat timeline sesi meskipun skill terhenti di tengah jalan | (hook `gstack-timeline-stop`) |

Untuk mematikan atau menyalakan fitur (jalankan di Git Bash):

```bash
~/.claude/skills/gstack/bin/gstack-config set skill_routing off
~/.claude/skills/gstack/bin/gstack-config set destructive_guard on
```

Perubahan berlaku mulai prompt berikutnya.

Backup `settings.json` sebelum gstack diinstal tersimpan di:
`C:\Users\nau\.claude\settings.json.bak-before-gstack`

---

## 6. Perawatan dan troubleshooting

### Update gstack

Cara termudah: ketik `/gstack-upgrade` di Claude Code.

Kalau update manual dengan `git pull`, **wajib** jalankan ulang setup. Di Windows, skill disalin (bukan symlink), jadi tanpa setup ulang file skill tidak ikut berubah:

```bash
cd ~/.claude/skills/gstack && git pull && ./setup
```

### Cek kesehatan instalasi

```bash
~/.claude/skills/gstack/bin/gstack-doctor
```

Kondisi terakhir: **12 ok, 0 warn, 0 fail**, dengan 3 fitur opsional yang belum dikonfigurasi (lihat di bawah).

### Masalah yang mungkin muncul

| Gejala | Penyebab dan solusi |
|---|---|
| `/browse`, `/qa`, `/make-pdf` gagal dengan `Permission denied` | Windows Smart App Control memblokir program gstack yang tidak ditandatangani. Matikan Smart App Control (sudah dilakukan di komputer ini), lalu jalankan `cd ~/.claude/skills/gstack && ./setup`. |
| Bun crash saat `./setup` | Versi Bun terlalu lama. Jalankan `bun upgrade` (di komputer ini sudah versi 1.4.5). |
| `/cso` menampilkan "not assessed" | Perlu **Visual Studio 2022 Build Tools** dengan workload "Desktop development with C++". Setelah terinstal, jalankan ulang `./setup`. |
| `/codex` tidak berfungsi | Opsional. Perlu Codex CLI: `npm install -g @openai/codex`, lalu `codex login`. |
| Skill baru tidak muncul | Restart Claude Code atau reload window VS Code. |

### Menghapus gstack

Ikuti panduan resmi: https://github.com/garrytan/gstack/blob/main/docs/uninstall.md

---

## 7. Tips

- **Jangan langsung memakai semua skill.** Mulailah dengan `/office-hours`, `/review`, dan `/qa`. Setelah terbiasa, baru coba `/autoplan` dan `/ship`.
- Untuk project website (misalnya template SaCMS), alur yang cocok: `/plan-eng-review` → kerjakan → `/review` → `/qa http://localhost:3000` → `/design-review`.
- Jalankan `/context-save` sebelum menutup sesi panjang, lalu `/context-restore` keesokan harinya.
- Dokumentasi lengkap (bahasa Inggris) ada di folder `~/.claude/skills/gstack/docs/`.
