# Prompt untuk Claude Code — Build LongTail Dashboard Management System (LTMS)

Gunakan isi file ini sebagai instruksi awal ke Claude Code (via CLI/desktop/mobile).
Lampirkan juga file `PRD-LongTail-Dashboard-v1_2.md` di direktori project sebagai
referensi lengkap — prompt ini adalah ringkasan eksekusi, PRD adalah sumber kebenaran
untuk detail.

---

## 0. Peran & Cara Kerja

Kamu adalah engineer yang membangun **LongTail Dashboard Management System (LTMS)**
berdasarkan PRD terlampir (`PRD-LongTail-Dashboard-v1_2.md`). Kerjakan **bertahap per
fase** sesuai urutan di bawah, jangan loncat ke fase berikutnya sebelum fase
sebelumnya berjalan dan bisa didemokan. Di setiap fase:

1. Baca ulang bagian PRD yang relevan sebelum coding.
2. Buat rencana singkat (file/struktur yang akan dibuat) sebelum menulis kode.
3. Setelah selesai, jalankan/build untuk memastikan tidak error, lalu ringkas apa
   yang sudah jadi dan apa yang belum.
4. Jika ada instruksi PRD yang ambigu atau berpotensi konflik, **tanya dulu**
   sebelum mengasumsikan — terutama untuk aturan bisnis (aging, dedup, locking).

Jangan mengubah keputusan arsitektur di PRD (misalnya tetap pakai Google Sheets
sebagai data store fase MVP) tanpa konfirmasi eksplisit.

---

## 1. Ringkasan Proyek

Aplikasi web internal untuk menggantikan proses manual Long Tail (copy-paste Excel
ke Google Sheet) dengan sistem import otomatis, dashboard monitoring, dan halaman
feedback harian untuk Admin Cabang & Admin DP.

**Stack wajib:**

- Frontend: Next.js (App Router) + React + TypeScript + Tailwind CSS + shadcn/ui +
  TanStack Table + React Query + SheetJS (xlsx) untuk parsing file Excel di client.
- Deploy target: Vercel.
- Backend: Google Apps Script sebagai REST API layer di depan Google Sheets
  (fase MVP — lihat Bagian 3 PRD untuk batas volume & rencana migrasi).
- Auth: Google Workspace SSO (domain internal saja).

---

## 2. Struktur Data Wajib (Google Sheets)

Buat/gunakan sheet berikut persis sesuai PRD Bagian 14:

| Sheet | Fungsi | Terlihat user? |
|---|---|---|
| `Users` | Master user + role + DP terkait | Tidak langsung (via Master User) |
| `LongTail` | **1 baris per waybill**, termasuk kolom `Log Feedback` (teks menumpuk, lihat Bagian 4 prompt ini) | Ya |
| `LongTail_Archive` | Paket Clear TTD > 30 hari dipindah ke sini | Tidak |
| `Master Feedback` | Daftar opsi feedback baku | Ya (halaman Master Feedback) |
| `Favorite Feedback` | Feedback favorit per Admin DP | Ya |
| `Import Batch` | Riwayat proses import | Ya (Riwayat Import) |
| `Activity_Log` | **Tersembunyi total.** Sumber data terstruktur untuk Dashboard/KPI + audit trail | Tidak, tidak ada UI untuk membukanya |

Kolom `LongTail` minimum: No. Waybill, Status Terakhir, Alasan Paket Bermasalah,
DP Sampai, Waktu Sampai, Umur Paket, Sprinter Delivery, COD, Delivery Attempt,
Feedback (isian terkini), **Log Feedback** (teks menumpuk).

Kolom `Activity_Log` minimum: User, DP, Waybill, Attempt ke- (auto-increment per
waybill), Data Lama, Data Baru, Tanggal, Jam, Sumber Perubahan (Manual
Feedback / Auto-update Import).

---

## 3. Aturan Bisnis Kritis (implementasikan persis, ini paling sering salah)

1. **Umur Paket** = `Hari Ini - Waktu Sampai`, dihitung otomatis.
   **Berhenti bertambah begitu status = Clear TTD** (nilai dibekukan di angka
   saat itu, tidak terus jalan setelahnya). Ini indikator prioritas utama sistem
   — jangan sampai salah.
2. **Warna Aging** di tabel Feedback: 1 hari = hijau, 2 hari = kuning,
   ≥ 3 hari = merah. Default sorting: umur paket tertua di atas.
3. **Dedup waybill lintas batch import** (bukan cuma dalam satu file):
   - Waybill baru yang sudah ada di `LongTail` dan **belum Clear TTD** →
     update baris yang sama (bukan bikin baris baru).
   - Waybill yang **sudah Clear TTD** tapi muncul lagi di file baru → tandai
     `Perlu Review`, jangan menimpa status Clear TTD otomatis.
4. **Log Feedback (kolom, bukan sheet/tab baru):**
   - Setiap submit feedback baru untuk waybill yang belum Clear TTD → sistem
     baca isi sel `Log Feedback` saat ini, tambahkan baris baru di akhir teks
     dengan format `DD/MM/YY : <feedback>` dipisah newline, tulis ulang ke
     sel yang sama. **Isi lama tidak pernah dihapus.**
   - Contoh isi sel setelah 3 hari:
     ```
     12/07/26 : Reschedule waktu pengiriman
     13/07/26 : Penerima Tidak Di Tempat
     14/07/26 : Diterima penerima
     ```
   - **Paralel dengan itu**, tambahkan satu baris terstruktur ke `Activity_Log`
     (kolom terpisah: Tanggal, Waybill, Attempt ke-, Feedback, Admin DP) — ini
     yang dipakai Dashboard untuk hitung statistik, **bukan** dengan
     mem-parsing teks `Log Feedback`.
   - User tidak pernah melihat/membuka `Activity_Log`.
5. **Locking / konkurensi:**
   - Saat proses Import berjalan, pakai `LockService` (Apps Script) agar tidak
     ada proses tulis lain (termasuk Auto Save feedback) bentrok ke sheet yang
     sama di waktu bersamaan.
   - Saat Admin DP edit baris feedback: tandai baris "sedang diedit oleh [nama]"
     untuk user lain (soft-lock), dan pakai **optimistic locking** saat Auto
     Save — jika data di server sudah berubah sejak baris dimuat, tampilkan
     peringatan, jangan menimpa diam-diam.
6. **Auto Mapping Header saat import:** jika header file tidak dikenali sistem,
   tampilkan UI mapping manual di tahap Preview sebelum Import — jangan gagal
   total tanpa opsi perbaikan.
7. **Partial failure saat multi-upload:** setiap file diproses independen. Jika
   1 dari beberapa file gagal, file lain tetap lanjut diimport; file gagal bisa
   diupload ulang tanpa mengulang seluruh batch.
8. **Hak akses:** Admin DP hanya boleh melihat data DP miliknya. Validasi ini
   **wajib di level API** (backend), jangan hanya disembunyikan di UI.

---

## 4. Urutan Eksekusi (Fase MVP)

Kerjakan sesuai urutan ini, sesuai daftar MVP di PRD Bagian 17:

**Fase 1 — Setup & Auth**
- Inisialisasi project Next.js + TypeScript + Tailwind + shadcn/ui.
- Setup Google Workspace SSO, session HttpOnly cookie (expired 8 jam idle).
- Role dari sheet `Users`, bukan klaim client.

**Fase 2 — Backend API (Apps Script)**
- Endpoint REST dasar (CRUD) untuk `LongTail`, `Master Feedback`,
  `Favorite Feedback`, `Users`, `Master Drop Point`.
- Implementasikan `LockService` untuk operasi tulis.

**Fase 3 — Import Long Tail**
- Multi upload + drag & drop, parsing pakai SheetJS di client.
- Merge data, dedup dalam file & lintas batch (Bagian 3 prompt ini poin 3).
- Auto mapping header + fallback manual UI.
- Preview → Import (dengan lock) → Riwayat Import.
- Partial failure handling per file.

**Fase 4 — Halaman Feedback**
- Tabel gaya spreadsheet: sticky header, search, filter, sorting, pagination,
  keyboard-friendly (Enter pindah baris), highlight baris aktif, auto save.
- Kolom `Log Feedback` (append dalam sel) + penulisan paralel ke `Activity_Log`.
- Soft-lock & optimistic locking saat edit bersamaan.
- Favorite Feedback (dropdown: favorit dulu, lalu master, type-to-search).
- Warna aging + default sort umur tertua.

**Fase 5 — Dashboard**
- Dashboard Admin Cabang: summary card, 4 chart (Distribusi Feedback, Statistik
  Aging 1–7+ hari, Progress per DP, Progress per Sprinter Delivery), tabel
  Monitoring DP.
- Dashboard Admin DP: summary card + 2 chart (scoped ke DP miliknya).
- Semua angka dihitung dari `Activity_Log` + `LongTail`, bukan parsing teks.

**Fase 6 — Master Data & Riwayat**
- Master User, Master Drop Point, Master Feedback (CRUD, Admin Cabang only).
- Halaman Riwayat Feedback (Admin DP) & Riwayat Import (Admin Cabang).

**Fase 7 — Notifikasi Aging**
- Badge/alert di Dashboard untuk paket ≥ 3 hari belum Clear TTD.
- (Opsional MVP) email harian ringkasan ke Admin DP & Admin Cabang.

**Fase 8 — Arsip Data**
- Job/endpoint untuk memindahkan baris Clear TTD > 30 hari dari `LongTail` ke
  `LongTail_Archive` (jalankan manual dulu di MVP, cron/trigger di fase
  berikutnya jika disetujui).

---

## 5. Di Luar Scope MVP (jangan dikerjakan dulu)

- Migrasi ke database relasional.
- Notifikasi WhatsApp/SMS.
- Integrasi API langsung ke JMS (tetap manual upload Excel).
- Multi-level approval untuk Master Feedback.
- Aplikasi mobile native.

---

## 6. Definition of Done per Fase

Sebelum lanjut ke fase berikutnya, pastikan:

- Build/dev server jalan tanpa error.
- Aturan bisnis di Bagian 3 prompt ini sudah diverifikasi dengan skenario nyata
  (bukan cuma "terlihat benar") — terutama freeze umur paket saat Clear TTD dan
  append `Log Feedback` tanpa menimpa isi lama.
- Tidak ada validasi hak akses yang hanya di sisi client.
- Ringkas ke user: apa yang selesai, asumsi yang diambil, dan apa yang perlu
  dikonfirmasi sebelum lanjut fase berikutnya.
