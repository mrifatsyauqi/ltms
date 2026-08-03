# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-08-03

### Fixed
- **Perbaikan Parsing Format Tanggal & Waktu Excel Serial Date (`/monitoring-inc`)**:
  - **Penyebab Masalah**: File tarikan JMS menyimpan tanggal dan waktu dalam bentuk bilangan desimal *Excel Serial Date Number* (contoh: `46237.36094907407` dan `46236.76099537037`). Hal ini menyebabkan parser standar JavaScript menghasilkan `Invalid Date`, kolom Maksimal TTD menjadi `-`, dan seluruh resi salah terkategorisasi sebagai `Belum TTD`.
  - **Solusi**: Mengembangkan modul `web/src/lib/excel-date.ts` (`parseExcelDate` dan `formatDisplayDateTime`) yang mampu mendeteksi dan mengonversi:
    1. *Excel Serial Float Numbers* (berbasis epoch 1899-12-30 dengan presisi jam, menit, dan detik).
    2. Format teks ISO (`YYYY-MM-DD HH:mm:ss`) dan format DMY (`DD/MM/YYYY HH:mm:ss`).
    3. Teks khusus seperti `Belum TTD`, `-`, `N/A`, atau string kosong secara cerdas dikembalikan sebagai `null`.
  - **Dampak Perbaikan**:
    - Kolom **Waktu Upload ke Sistem** tampil rapi sebagai `YYYY-MM-DD HH:mm:ss` (contoh: `2026-08-02 18:15:38`).
    - Kolom **Maksimal TTD** berhasil dikalkulasi secara presisi (`Waktu Input + 24 Jam`, contoh: `18:15:38`).
    - Kolom **Waktu TTD** tampil rapi sebagai `YYYY-MM-DD HH:mm:ss` (atau teks `Belum TTD` jika belum ada tanda terima).
    - Status **Clear TTD** vs **Telat SLA** vs **Belum TTD** terkalkulasi 100% akurat sesuai waktu tanda terima.

### Added
- **Modern Compact Enterprise Redesign — Monitoring INC (`/monitoring-inc`)**:
  - **Zero-Scroll Viewport Optimization (1920×1080 & 1366×768)**:
    - Seluruh alur kerja operator (4 tahap: *Target Kota* → *Upload Excel* → *Review File* → *Generate Monitoring*) dirancang secara ringkas dan presisi agar pas dalam satu layar desktop tanpa memerlukan scroll vertikal.
    - Mengadopsi standar visual modern enterprise (terinspirasi dari Stripe, Vercel, dan Linear): background `#F8FAFC`, kartu putih bersih (`#FFFFFF`), sudut melengkung `16px` (`rounded-2xl`), border halus `#E5E7EB`, dan soft shadow.
  - **Header & Target Kota Terpadu**:
    - Judul 28px/32px Extra-Bold, subjudul ringkas satu baris tanpa paragraf instruksi panjang yang memakan ruang.
    - Selector Target Kota interaktif (`📍 BATANG ▼`) di sudut kanan atas dengan opsi multi-kota dan penguncian otomatis (ikon gembok) untuk peran Admin DP / SPV Drop Point.
  - **Alur 2-Kolom: Step 1 Upload Card & Step 2 Uploaded File Card**:
    - `upload-card.tsx`: Ketinggian dropzone dipadatkan ~40%, dilengkapi ikon awan pastel, border putus-putus transisi halus saat drag & drop, tombol primer merah `[↑ Pilih File Excel]`, serta efek partikel konfeti mengambang saat file dipilih.
    - `uploaded-file-card.tsx`: Menampilkan kartu ringkasan horizontal dengan badge dokumen Excel hijau, nama file, ukuran, jumlah total resi terdeteksi, tanggal upload, serta tombol aksi cepat **Ganti File** dan **Hapus**.
  - **Step 3: Generate Monitoring & Animated Processing Chips (`generate-section.tsx`)**:
    - Tombol utama merah tebal `[⚡ Generate Monitoring]` dengan efek klik aktif (*active scale tap*).
    - Menampilkan bar chip status pemrosesan berurutan (500–700ms per tahap) saat diklik:
      1. `✔ Membaca File`
      2. `✔ Memfilter Kota`
      3. `✔ Mapping Kecamatan`
      4. `⟳ Menghitung SLA` (animasi spinner aktif)
      5. `✔ Menyimpan Monitoring`
    - Berubah otomatis menjadi tombol hijau sukses dan menampilkan toast notifikasi sebelum transisi halus ke halaman laporan.
  - **Riwayat File Terakhir Compact Table (`recent-history-card.tsx`)**:
    - Tabel ringkas satu baris (tinggi < 120px) yang menyimpan file terakhir di penyimpanan lokal browser (*persistent LocalStorage*) dengan tombol download.
  - **Tampilan Laporan & Tabel Modern (`results-view.tsx` & `monitoring-inc-table.tsx`)**:
    - 5 Kartu Metrik KPI: **Total AWB INC** (Biru), **Clear TTD (≤24 Jam)** (Hijau), **Belum TTD (>24 Jam)** (Kuning), **Telat SLA (24 Jam)** (Merah), dan **Rata-rata SLA (Jam)** (Ungu).
    - Struktur kolom tabel 100% identik dengan template Excel resmi: `AWB`, `Tempat Tujuan`, `Nama Penerima`, `Alamat Penerima`, `COD`, `Waktu TTD`, `Maksimal TTD`, `Waktu Upload ke Sistem`, dan `Status`.
    - Dilengkapi *sticky header* (`#F8FAFC`), baris selang-seling (*zebra rows*), efek sorot baris (*hover effect*), badge status berwarna, serta kontrol paginasi lengkap (`10 / 25 / 50 / 100 / Semua`).
    - 3 Kartu Ringkasan Bawah: **Total AWB Outgoing INC**, **Clear TTD**, dan **Presentase (%)**.
  - **Fitur Copy Gambar Laporan Beresolusi Tinggi (`report-image-canvas.tsx`)**:
    - Menghasilkan gambar PNG beresolusi tinggi (2x Retina Pixel Ratio) berisi logo kubus LTMS, judul, target kota, waktu generate, 5 kartu KPI, tabel lengkap, dan kartu ringkasan untuk langsung disalin ke Clipboard (siap di-paste ke WhatsApp/Telegram/Feishu).
    - Fitur **Export Excel** (`.xlsx`) lengkap dengan ringkasan otomatis di bagian bawah sheet.

- **Modul Matching Kota & Resolver Drop Point (`city-matcher.ts` & `city-matcher.test.ts`)**:
  - Utilitas `normalizeCityName`, `isCityMatch`, dan `resolveCityFromDropPoint` dengan pengujian unit lengkap (100% pass) untuk mencegah *false-positive* pada nama kota majemuk (seperti `BATANG HARI` vs `BATANG`).

---

## [Unreleased] - 2026-07-28

### Added
- **Fitur Monitoring Delivery**:
  - Menu monitoring delivery JMS dengan parsing sprinter, kalkulasi TTD, persentase performa, dan ekspor gambar/tabel ke clipboard.
