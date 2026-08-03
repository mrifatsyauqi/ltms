# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2026-08-03

### Added
- **Redesign Halaman Monitoring INC (`/monitoring-inc`) — Alur Kerja Upload-First Modern**:
  - **Desain Minimalis & Terfokus (Stripe / Vercel Aesthetic)**:
    - Merestrukturisasi halaman menjadi 4 seksi alur kerja bersih dengan whitespace optimal dan bebas distraksi visual.
    - Background `#F8FAFC`, kartu `#FFFFFF`, radius `16-18px`, dan shadow lembut `0 8px 24px rgba(0,0,0,.04)`.
  - **Seksi 1: Header & Selector Target Kota**:
    - Judul 28px font-bold dan subjudul deskripsi SLA 24 jam.
    - Selector Target Kota interaktif (`📍 BATANG ▼`) di kanan atas dengan dropdown modern (otomatis terkunci dengan ikon gembok untuk role Admin DP).
  - **Seksi 2: Upload Tarikan Data JMS (`upload-card.tsx`)**:
    - Area upload lebar penuh dengan border putus-putus (`2px dashed #E5E7EB`).
    - Animasi spring dan transisi warna halus saat drag-over dan file terpilih.
    - Mikro-animasi centang sukses dan efek konfeti ringan (10–12 partikel lembut) saat file Excel dimasukkan.
    - Validasi format (`.xlsx`, `.xls`) dan batas ukuran (< 10 MB) dengan pesan peringatan inline.
  - **Seksi 3: File Berhasil Diupload (`uploaded-file-card.tsx`)**:
    - Animasi kemunculan *Fade Up + Scale* (`0.98 -> 1`, `duration 250ms`).
    - Layout horizontal memuat ikon Excel hijau, nama file, ukuran file, jumlah resi terdeteksi, tanggal upload, serta tombol **Ganti File** dan **Hapus**.
  - **Seksi 4: Generate Monitoring & Step Progress Animation (`generate-section.tsx`)**:
    - Tombol utama merah full-rounded (`height 48px`, font-semibold 15px) dengan animasi scale-tap (`1 -> 0.97 -> 1`).
    - Animasi indikator progres berurutan (500–700ms per tahap):
      1. `✔ Membaca File`
      2. `✔ Memfilter Kota`
      3. `✔ Mapping Kecamatan`
      4. `✔ Menghitung SLA`
      5. `✔ Menyimpan Monitoring`
    - Tombol berubah menjadi hijau sukses `✔ Lihat Hasil Monitoring` disertai notifikasi toast di pojok kanan bawah.
  - **Seksi 5: Riwayat File Terakhir (`recent-history-card.tsx`)**:
    - Tabel riwayat upload file terakhir yang tersimpan secara lokal (*persistent LocalStorage*) dengan status *Berhasil* dan tombol aksi unduh.
  - **Seksi 6: Tampilan Laporan & Ekspor Interaktif (`results-view.tsx`)**:
    - Metrik ringkas (Total AWB INC, Clear TTD, Belum TTD, Telat SLA 24 Jam, dan Total Nilai COD).
    - Fitur **Salin Gambar** (langsung paste ke WA/Feishu), **Salin Tabel** (HTML & TSV untuk Excel/Spreadsheet), dan **Unduh Excel** (`.xlsx`).
    - Filter status pills, filter kecamatan, serta kolom pencarian instan (AWB, Nama Penerima, Alamat).
    - Tombol navigasi kembali ke alur upload kapan saja.

- **Pondasi Multi-Kota & Normalisasi Pencocokan Kota (`city-matcher.ts`)**:
  - Mengembangkan fungsi `normalizeCityName`, `isCityMatch`, dan `resolveCityFromDropPoint`.
  - Mencegah *false positive* pencocokan kota (misal: data dari `KOTA BATANG HARI` tidak lagi keliru terdeteksi sebagai `BATANG` karena menggunakan *token-boundary match*).
  - Mengaitkan akun Drop Point secara otomatis ke kota induknya (misal `DP BATANG01` langsung terpetakan ke kota `BATANG`).
  - Menyediakan unit test lengkap di `web/src/lib/city-matcher.test.ts`.

- **Rebranding Aplikasi ke LongTail Monitoring System (LTMS)**:
  - Mengubah penamaan dari *Longtail Dashboard management system* menjadi **LongTail Monitoring System (LTMS)**.
  - Memperbarui title tag, manifest, dan meta deskripsi browser.

### Fixed
- Memperbaiki error build TypeScript terkait import fungsi `resolveCityFromDropPoint` pada `monitoring-inc-client.tsx`.
- Memperbaiki ketidakcocokan tipe parameter `handleCityChange` untuk mendukung tipe `string | null` dari komponen `Select`.
- Mengganti dependensi `dropdown-menu` yang belum terdaftar dengan komponen `Select` standar.

---

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
