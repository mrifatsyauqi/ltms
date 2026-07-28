# Changelog

All notable changes to this project will be documented in this file.

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
