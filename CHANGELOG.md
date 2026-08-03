# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-08-03

### Added
- **Fitur Baru: Monitoring Inter City (INC) (`/monitoring-inc`)**
  - **Menu & Navigasi**:
    - Menambahkan menu baru dengan judul teks `"Monitoring INC"` dan icon `Truck` di navigasi sidebar (`web/src/lib/nav.ts`).
    - Diberikan izin akses secara default untuk role Full Access (Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota) dan role Drop Point (SPV Drop Point, Admin DP).
    - Mendaftarkan key `monitoring_inc` ke dalam `MENU_KEYS` di `web/src/lib/data/supabase/permissions.ts`.
    - Menambahkan kartu konfigurasi izin `Monitoring INC` pada halaman manajemen Role & Akses (`web/src/components/master/role-akses-client.tsx`).
    - Menyediakan skrip migrasi database Supabase di `supabase/monitoring_inc_migration.sql`.
  - **Logika Ekstraksi & Filter JMS (Excel)**:
    - **Filter Wilayah Wajib**: Hanya memproses dan menampilkan data dengan **`Kota Penerima` = "BATANG"** (case-insensitive & whitespace-safe). Data selain Kota Batang diabaikan secara otomatis dari tarikan JMS.
    - **Pemetaan Kolom (Column Mapping)**:
      - `No. Waybill` $\leftarrow$ Kolom `AWB` / `No. Waybill` dari JMS.
      - `Tempat Tujuan` $\leftarrow$ Kolom `Kecamatan Penerima` (khusus dari data Kota Batang).
      - `Nama Penerima` $\leftarrow$ Kolom `Nama Penerima`.
      - `Alamat Penerima` $\leftarrow$ Kolom `Alamat Penerima`.
      - `COD` $\leftarrow$ Kolom `Biaya COD` / `COD` (diformat otomatis ke mata uang Rupiah atau Non-COD).
      - `Waktu Upload ke Sistem` $\leftarrow$ Kolom `Waktu Input`.
      - `Maksimal TTD (SLA)` $\leftarrow$ Dihitung secara otomatis: **`Waktu Input` + 24 Jam**.
      - `Waktu TTD` $\leftarrow$ Kolom `Waktu Upload TTD` / `Waktu TTD`.
    - **Kalkulasi & Indikator Status SLA**:
      - Paket yang telah memiliki `Waktu TTD` $\le$ `Maksimal TTD` dikategorikan **Tepat Waktu (On Time)**.
      - Paket yang memiliki `Waktu TTD` $>$ `Maksimal TTD` (atau waktu saat ini telah melampaui `Maksimal TTD` saat belum TTD) dikategorikan **Terlambat / Lewat SLA**.
      - Baris data yang terlambat / lewat batas SLA ditandai dengan **highlight warna merah** (`bg-red-500 text-white font-bold`) sesuai acuan visual template Excel 1.
  - **Tampilan Tabel Visual & Fitur Ekspor (Excel 1 Fidelity)**:
    - Komponen tabel `MonitoringIncTable` (`web/src/components/monitoring-inc/monitoring-inc-table.tsx`) dengan desain header dua warna (Navy dan Abu-abu), border sel presisi, dan footer total ringkasan.
    - Komponen interaktif `MonitoringIncClient` (`web/src/components/monitoring-inc/monitoring-inc-client.tsx`) dengan kartu KPI (Total Paket Batang, On Time, Terlambat, Belum TTD, Total Nilai COD).
    - Filter pencarian cepat real-time (No. Waybill, Nama Penerima, Kecamatan).
    - Filter status SLA (Semua, Tepat Waktu, Terlambat, Belum TTD).
    - **Salin Gambar (Copy Image)**: Mengonversi tabel menjadi PNG beresolusi tinggi menggunakan `html-to-image` dan menyalin ke clipboard untuk kemudahan share ke WhatsApp/Telegram.
    - **Salin Tabel (Copy Table)**: Menyalin data dalam format TSV/HTML untuk di-paste langsung ke Google Sheets / Excel.
    - **Export Excel**: Mengunduh data yang telah difilter ke dalam file format `.xlsx`.
  - **Testing & Quality Assurance**:
    - Menambahkan unit test di `web/src/lib/nav.test.ts` dan `web/src/lib/data/supabase/permissions.test.ts`.
    - Seluruh test suite (216 tests) lolos dengan status 100% PASS dan validasi type TypeScript (`tsc --noEmit`) 0 error.

### Workflow & Deployment Rules
- **Aturan Alur Kerja**: Semua perubahan fitur baru wajib di-push ke repository/branch **`ltms-mvp`** terlebih dahulu untuk direview dan diuji secara manual oleh tim, sebelum dikonfirmasi untuk merge ke branch `main`.

## [Unreleased] - 2026-07-28

### Added
- **Fitur Baru: Monitoring Delivery**
  - Menambahkan menu "Monitoring Delivery" di sidebar khusus untuk peran Admin Cabang dan Admin DP.
  - Memungkinkan admin untuk mengunggah (*upload*) file laporan JMS format Excel (`.xlsx`, `.xls`, `.csv`).
  - Menguraikan data JMS secara otomatis: menyaring baris khusus Sprinter (diawali dengan "Mtr") dan mengkalkulasi matriks seperti Jumlah Waybill Delivery, Tanda Terima, Belum Diterima, Paket Bermasalah, dan Presentase TTD.
  - Tabel disajikan dengan format persis menyerupai *template* laporan Excel asli.
  - Fitur input manual "Total Sampai" sebelum pembuatan tabel (generasi 2 langkah) beserta pengurutan otomatis persentase TTD dari tertinggi ke terendah.
  - Header tebal baru pada tabel (`MONITORING DELIVERY [NAMA DP]`) yang secara otomatis mendeteksi nama DP akun yang digunakan.
  - Menambahkan indikator sel berwarna khusus untuk nilai Persentase TTD:
    - **Hijau**: $\ge$ 95%
    - **Kuning Muda**: 90% - 94.9%
    - **Merah**: $\le$ 90%
- **Fitur Copy as Image (Clipboard API)**
  - Menambahkan pustaka `html-to-image` untuk mengubah tabel HTML menjadi gambar *base64*.
  - Mengimplementasikan `ClipboardItem` tingkat lanjut yang menghasilkan 3 tipe *payload* sekaligus (Gambar PNG, Teks, dan Tabel HTML).
  - Menyematkan fungsi cerdas yang secara otomatis menggunakan format Gambar saat di-*paste* ke aplikasi Chat (seperti WhatsApp) dan format Tabel saat di-*paste* kembali ke Spreadsheet/Excel.

### Fixed
- Memperbaiki peringatan *Interaction to Next Paint (INP)* pada tombol "Copy as Image" dengan menggunakan pendekatan janji asinkron (*asynchronous Promise*) pada ClipboardItem, sehingga tombol tidak membekukan (*freeze*) layar saat proses gambar berjalan.
- Mengatasi masalah otorisasi keamanan browser Clipboard API terkait hilangnya *user-gesture context* dengan menghapus jeda `setTimeout` yang berlebihan.
