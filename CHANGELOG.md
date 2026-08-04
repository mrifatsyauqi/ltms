# Changelog

All notable changes to this project will be documented in this file.

---

## [v2.2.0] - 2026-08-04 (LTMS v2.2: Smart Share, Table Sorting & Enterprise UI/UX Overhaul)

### Added
- **Fitur 1-Click "Smart Share" (`/monitoring-inc`)**:
  - **Single-Click Pipeline**: Mengotomatiskan seluruh alur pelaporan monitoring pengiriman dalam satu klik tombol *Smart Share*.
  - **Framer Motion Loading State Machine**: Menampilkan progres visual interaktif (*Preparing Data* → *Generating Report* → *Rendering Image 1200×900* → *Formatting Caption* → *Copying to Clipboard* → *Completed*).
  - **Auto-Caption Generator**: Menyusun ringkasan teks otomatis berformat rapi untuk WhatsApp/Feishu dengan rincian:
    - Judul & Kota Tujuan
    - Tanggal & Waktu Generate (WIB)
    - Metrik KPI: Total Resi, Belum TTD, Melebihi SLA, dan Presentase Progress
    - Rincian Top Kecamatan tujuan pengiriman
    - Pesan instruksi follow-up tanpa mencantumkan tautan dashboard.
  - **Smart Share Success Dialog**: Modal interaktif dengan thumbnail preview gambar 1200×900, checklist status, tombol salin ulang caption, dan tombol download resolusi tinggi PNG.

- **Client-Side Table Sorting dengan TanStack Table (`monitoring-inc-table.tsx`)**:
  - Mengintegrasikan `@tanstack/react-table` dengan siklus 3-state sorting (*Default* → *Ascending* → *Descending* → *Default*).
  - Indikator arah sorting visual interaktif (`ArrowUp`, `ArrowDown`, `ArrowUpDown`) dengan penanda warna merah brand `#E2231A` pada kolom aktif.
  - Nilai awal terurut otomatis berdasarkan nama **Tempat Tujuan (Kecamatan)**.

- **Progressive Upload Loading State Machine (`upload-card.tsx`)**:
  - Menghadirkan alur loading bertahap dengan progress bar dinamis: *Reading Excel File* → *Parsing Dataset* → *Filtering Target City* → *Counting Destination Waybill* → *Validating Structure* → *Verifying File*.
  - Dilengkapi animasi transisi teks dan progress bar gradient modern.

- **Page Transition Wrapper (`page-transition.tsx`)**:
  - Transisi halaman halus 150ms (fade & slide-up) saat berpindah rute di seluruh aplikasi.

### Changed
- **Penyelarasan Design System & Enterprise Micro-Interactions**:
  - Standardisasi token warna brand: **Primary `#E2231A`**, **Hover `#C91C15`**, **Border `#E5E7EB`**, **Soft Slate `#F8FAFC`**.
  - Standardisasi radius sudut:
    - **Buttons & Inputs**: `rounded-[6px]`
    - **Cards**: `rounded-[8px]`
    - **Dialogs & Modals**: `rounded-[10px]`
    - **Badges & Pills**: `rounded-full` / `rounded-[4px]`
  - Micro-interactions:
    - Tombol dengan efek `active:scale-[0.98]`
    - Kartu dengan efek hover border & elevasi halus `hover:-translate-y-0.5`
    - Modal & Dialog dengan transisi zoom-in `scale-95` ke `scale-100`.
- **Ekspor Gambar Canvas Enterprise 1200×900 (`report-image-canvas.tsx`)**:
  - Tampilan visual beresolusi tinggi dengan Logo LTMS, ringkasan 4 kartu KPI, distribusi Top Kecamatan, dan rincian data pengiriman.
- **Audit Loading State Global**:
  - Menambahkan spinner `Loader2` dan proteksi disabled state pada tombol login dan dialog aksi.

---

## [Unreleased] - 2026-08-03 (Revisi 3: UI & Ergonomic UX Overhaul Monitoring INC)

### Changed
- **Penyelarasan Tipografi & Struktur Header Halaman (`/monitoring-inc`)**:
  - Menyelaraskan ukuran judul utama dari yang sebelumnya terlalu besar dan tebal (`text-2xl md:text-3xl font-extrabold`) menjadi proporsional dan harmonis dengan `PageHeader` halaman lain (`text-lg md:text-xl font-semibold tracking-tight text-slate-900`).
  - Menghapus penempatan canggung tombol *Upload Ulang* di samping kiri judul, dan memindahkannya ke dalam **Toolbar Aksi Kanan** terpadu (`[← Upload File Baru]`, `[📍 Target Kota]`, `[📋 Salin Gambar]`, `[⬇ Ekspor Excel]`).

- **Animasi Loading & Skeleton Upload File Profesional (`upload-card.tsx`)**:
  - Menghapus efek partikel konfeti ping.
  - Menggantikannya dengan **Skeleton Shimmer Loading** dan efek **Animated Glowing Border Ring** mengelilingi dropzone dan tombol upload saat file dipilih atau diparsing.

- **Restrukturisasi 4 Kartu KPI Metrik & Pembersihan Kartu Bawah (`results-view.tsx` & `report-image-canvas.tsx`)**:
  - Mengubah ringkasan metrik atas menjadi **4 Card**:
    1. **Total AWB INC** (Biru / Neutral Slate)
    2. **Clear TTD (≤24 Jam)** (Emerald Hijau)
    3. **Belum TTD / Telat** (Amber / Rose)
    4. **Presentase TTD** (Indigo / Ungu — menggantikan Rata-rata SLA Jam sebelumnya)
  - **Menghapus 3 kartu ringkasan redundan di bawah tabel data**.

- **Header Gambar Ekspor Formal & Tanpa Logo LTMS (`report-image-canvas.tsx`)**:
  - Menghapus logo kotak merah LTMS dan teks branding.
  - Menggantikannya dengan header laporan formal: Judul **MONITORING INC**, Unit/Cabang **DP [NAMA DP / TARGET KOTA]**, dan tanggal/jam generate di sisi kanan.

- **Pengurangan Sudut Kelengkungan (*Border Radius*) & Bahasa Desain Anti-Fatigue**:
  - Mengurangi radius sudut dari `rounded-2xl` menjadi `rounded-xl` (12px) untuk card container, `rounded-lg` (8px) untuk dropzone/table, dan `rounded-md` (6px) untuk tombol / input / status badge.
  - Menerapkan palet warna tenang *soft neutral slate* (`#F8FAFC`) untuk mengurangi kelelahan mata operator saat bekerja seharian.

---

## [Unreleased] - 2026-08-03 (Revisi 2: Fix Parsing Waktu Excel Serial Date)

### Fixed
- **Perbaikan Parsing Format Tanggal & Waktu Excel Serial Date (`/monitoring-inc`)**:
  - **Penyebab Masalah**: File tarikan JMS Excel menyimpan data waktu dan tanggal dalam format bilangan desimal (*Excel Serial Date Number*), seperti `46237.36094907407` (Waktu TTD) dan `46236.76099537037` (Waktu Upload). Saat diparse langsung menggunakan `new Date(string)`, JavaScript menghasilkan `Invalid Date`. Akibatnya:
    1. Kolom **Maksimal TTD** gagal dihitung dan menampilkan tanda strip (`-`).
    2. Kolom **Waktu TTD** dan **Waktu Upload ke Sistem** menampilkan angka mentah desimal yang rusak.
    3. Seluruh baris (32 resi) salah terkategorisasi menjadi status `Belum TTD` (0% Clear TTD).
  - **File Baru Ditambahkan**:
    - `web/src/lib/excel-date.ts`: Modul parser cerdas untuk konversi format tanggal:
      - Mengonversi *Excel Serial Float Number* (epoch `1899-12-30`) secara presisi ke tahun, bulan, tanggal, jam, menit, dan detik.
      - Mendukung format tanggal teks ISO (`YYYY-MM-DD HH:mm:ss`) dan format DMY (`DD/MM/YYYY HH:mm:ss`).
      - Menangani nilai khusus teks seperti `Belum TTD`, `-`, `N/A`, atau string kosong menjadi `null`.
    - `web/src/lib/excel-date.test.ts`: Unit test lengkap mencakup pengujian nomor desimal serial, string ISO, DMY, dan teks kosong.
  - **File Diperbarui**:
    - `web/src/components/monitoring-inc/monitoring-inc-client.tsx`: Mengintegrasikan `parseExcelDate` dan `formatDisplayDateTime` saat membaca baris Excel JMS.
  - **Hasil & Verifikasi**:
    - Nilai `46236.76099537037` terkonversi tepat menjadi `2026-08-02 18:15:38`.
    - Batas **Maksimal TTD** otomatis terhitung tepat `18:15:38` (24 Jam dari waktu upload).
    - Nilai `46237.36094907407` terkonversi tepat menjadi `2026-08-03 08:39:34`.
    - Status SLA otomatis terdeteksi akurat sebagai **Clear TTD** (`08:39:34` < `18:15:38`).
    - Seluruh pengujian (222/222 unit tests) lulus 100% dan TypeScript check lulus 0 error.

---

## [Unreleased] - 2026-08-03 (Revisi 1: Redesign Modern Compact Enterprise Zero-Scroll)

### Added
- **Modern Compact Enterprise Redesign — Monitoring INC (`/monitoring-inc`)**:
  - **Zero-Scroll Viewport Optimization (1920×1080 & 1366×768)**:
    - Merestrukturisasi alur kerja operator 4 tahap (*Target Kota* → *Upload Excel* → *Review File* → *Generate Monitoring*) agar pas dalam satu layar desktop tanpa memerlukan scroll vertikal.
    - Estetika modern terinspirasi oleh Stripe, Vercel, Linear, dan Notion: background `#F8FAFC`, kartu putih bersih (`#FFFFFF`), border halus `#E5E7EB`, sudut melengkung `16px` (`rounded-2xl`), dan *soft ambient shadows*.
  - **Struktur Komponen Modular Baru**:
    - `web/src/components/monitoring-inc/types.ts`: Definisi interface TypeScript lengkap (`IncRow`, `IncStats`, `UploadedFileInfo`, `RecentUploadHistoryItem`, dsb.).
    - `web/src/components/monitoring-inc/upload-card.tsx`: Komponen Step 1 Upload Excel padat (~40% lebih ringkas), dengan border putus-putus transisi lembut, tombol merah `[↑ Pilih File Excel]`, serta animasi partikel konfeti mengambang saat file dipilih.
    - `web/src/components/monitoring-inc/uploaded-file-card.tsx`: Komponen Step 2 Ringkasan File horizontal dengan badge Excel hijau, nama file, ukuran, total resi terdeteksi, tanggal upload, serta tombol aksi cepat **Ganti File** dan **Hapus**.
    - `web/src/components/monitoring-inc/generate-section.tsx`: Komponen Step 3 Tombol merah besar `[⚡ Generate Monitoring]` dengan efek klik aktif (*active scale tap*) dan bar indikator proses berurutan 5 tahap:
      1. `✔ Membaca File`
      2. `✔ Memfilter Kota`
      3. `✔ Mapping Kecamatan`
      4. `⟳ Menghitung SLA` *(spinner aktif)*
      5. `✔ Menyimpan Monitoring`
    - `web/src/components/monitoring-inc/recent-history-card.tsx`: Komponen Step 5 Tabel riwayat file terakhir compact (<120px) yang tersimpan di `localStorage` (*persistent*).
    - `web/src/components/monitoring-inc/results-view.tsx`: Tampilan hasil laporan memuat 5 Kartu KPI (*Total AWB INC*, *Clear TTD ≤24 Jam*, *Belum TTD >24 Jam*, *Telat SLA*, *Rata-rata SLA Jam*), filter pencarian instan, filter kecamatan, filter status pills, serta tombol navigasi kembali ke alur upload.
    - `web/src/components/monitoring-inc/monitoring-inc-table.tsx`: Tabel data modern dengan *sticky header* (`#F8FAFC`), *zebra striping*, efek sorot *hover*, status badges berbobot visual, dan kontrol paginasi lengkap (`10 / 25 / 50 / 100 / Semua`).
    - `web/src/components/monitoring-inc/report-image-canvas.tsx`: Canvas render tersembunyi beresolusi tinggi (2x Retina Pixel Ratio) untuk fitur **Salin Gambar Laporan** (siap di-paste ke WhatsApp/Telegram) dan **Export Excel** (`.xlsx`).
    - `web/src/components/monitoring-inc/monitoring-inc-client.tsx`: Koordinator utama state alur kerja upload, parsing data JMS, kalkulasi SLA 24 jam, dan pergantian mode tampilan.

- **Modul Pencocokan Nama Kota Cerdas (`web/src/lib/city-matcher.ts`)**:
  - Fungsi `normalizeCityName`, `isCityMatch`, dan `resolveCityFromDropPoint`.
  - Menggunakan *word-boundary matching* untuk mencegah *false positive* (contoh: `KOTA BATANG HARI` tidak keliru terdeteksi sebagai `BATANG`).
  - Mengaitkan akun Drop Point secara otomatis ke kota induknya (contoh: `DP BATANG01` langsung terpetakan ke kota `BATANG`).
  - Dilengkapi unit test lengkap di `web/src/lib/city-matcher.test.ts`.

---

## [Unreleased] - 2026-08-03 (Rilis Awal: Fitur Monitoring Inter City / INC)

### Added
- **Fitur Baru: Monitoring Inter City (INC) Outgoing (`/monitoring-inc`)**:
  - Menambahkan menu **Monitoring INC** pada navigasi sidebar LTMS.
  - Membaca dan memetakan kolom dari tarikan data JMS:
    - `AWB`: Kolom `No. Waybill` / `AWB` / `Nomor Resi`.
    - `Tempat Tujuan`: Kolom `Kecamatan Penerima` (difilter hanya untuk kota tujuan yang dipilih, default: **BATANG**).
    - `Nama Penerima`: Kolom `Nama Penerima`.
    - `Alamat Penerima`: Kolom `Alamat Penerima`.
    - `COD`: Kolom `Biaya COD` / `COD`.
    - `Waktu TTD`: Kolom `Waktu Upload TTD` / `Waktu TTD`.
    - `Maksimal TTD`: Kalkulasi otomatis maksimal 24 jam dari waktu input.
    - `Waktu Upload ke Sistem`: Kolom `Waktu Input`.
  - **SLA & Status Tracker**:
    - **Clear TTD**: Paket yang berhasil TTD dalam kurun waktu $\le$ 24 jam dari waktu input.
    - **Telat SLA**: Paket yang waktu TTD-nya melebihi batas 24 jam.
    - **Belum TTD**: Paket yang belum memiliki tanda terima.
  - **Sistem Hak Akses & Role Matrix**:
    - Menambahkan `menu_key: 'monitoring_inc'` ke dalam sistem matriks permissions LTMS.
    - Mengupdate `web/src/lib/nav.ts`, `web/src/lib/data/supabase/permissions.ts`, dan migrasi SQL `supabase/monitoring_inc_migration.sql`.
    - Menu dapat diakses oleh Admin Cabang, Manager Kota, Asisten Manager Kota, Super Admin, Admin DP, dan SPV Drop Point.

---

## [Unreleased] - 2026-07-28 (Fitur Monitoring Delivery & Rebranding LTMS)

### Added
- **Fitur Baru: Monitoring Delivery**:
  - Menu monitoring delivery JMS dengan parsing data Sprinter (Mtr), kalkulasi Waybill Delivery, Tanda Terima, Belum Diterima, Paket Bermasalah, dan Presentase TTD.
  - Tabel disajikan menyerupai template laporan Excel asli dengan pengurutan otomatis persentase TTD dari tertinggi ke terendah.
  - Indikator sel berwarna khusus untuk nilai Persentase TTD (Hijau $\ge$ 95%, Kuning Muda 90% - 94.9%, Merah $\le$ 90%).
- **Fitur Salin Gambar Beresolusi Tinggi (Clipboard API)**:
  - Dukungan multi-MIME payload `ClipboardItem` (Gambar PNG, Teks, dan Tabel HTML) sehingga kompatibel saat di-paste ke aplikasi chat (WhatsApp) maupun spreadsheet (Excel/Google Sheets).
- **Rebranding Sistem**:
  - Penamaan resmi sistem diperbarui menjadi **LongTail Monitoring System (LTMS)**.
