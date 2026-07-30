# Product Requirements Document (PRD)

# LongTail Dashboard Management System (LTMS)

**Version:** 1.3\
**Status:** Draft for Review\
**Perubahan dari v1.0 → v1.1:** Menambahkan keputusan arsitektur database, KPI, Out of Scope, penanganan konflik konkurensi, aturan aging pasca Clear TTD, notifikasi, master data, dan error handling import.\
**Perubahan v1.1 → v1.2:** Mengganti pendekatan sheet-per-hari dengan model "1 waybill = 1 baris" + kolom **Log Feedback** (riwayat feedback menumpuk dalam satu sel, tampil ke user) yang didukung sheet tersembunyi `Activity_Log` (data terstruktur untuk Dashboard).\
**Perubahan v1.2 → v1.3:** Mengganti mekanisme arsip "Clear TTD > 30 hari" dengan **Auto-Close real-time saat import** (paket yang hilang dari tarikan JMS langsung diarsipkan sebagai `Clear TTD` atau `CLOSE ALUR`); menambahkan status **CLOSE ALUR** dan pengaman konfirmasi import file < 100 baris (Bagian 7.4). Lihat **Lampiran A – Changelog** di akhir dokumen.

------------------------------------------------------------------------

# 1. Latar Belakang

Saat ini proses Long Tail masih menggunakan Google Sheet.

Alur kerja saat ini:

``` text
JMS
↓
Export Excel
↓
Admin Cabang
↓
Copy kolom secara manual ke template Google Sheet
↓
Admin DP
↓
Mengisi Feedback Long Tail
```

Permasalahan:

-   Copy paste masih manual.
-   Proses import memakan waktu.
-   Risiko salah copy data.
-   Sulit memonitor progres setiap DP.
-   Tidak ada dashboard monitoring.
-   Google Sheet mulai lambat ketika data banyak.

Selain itu, tujuan utama Long Tail adalah **memonitor paket yang belum
Clear TTD**, mengetahui **umur (aging) paket**, serta memastikan setiap
paket memiliki feedback hingga selesai.

------------------------------------------------------------------------

# 2. Tujuan

Membangun aplikasi web internal untuk membantu Admin Cabang dan Admin DP
dalam mengelola Long Tail secara lebih cepat, mudah dan terstruktur.

Target utama:

-   Menghilangkan proses copy-paste manual.
-   Mempercepat proses import data.
-   Mempermudah input feedback.
-   Monitoring paket yang belum Clear TTD.
-   Monitoring umur paket (Aging).
-   Menyediakan dashboard monitoring progress.

------------------------------------------------------------------------

# 3. Keputusan Arsitektur Data (Baru)

> Catatan: v1.0 menyatakan "tetap menggunakan Google Sheets sebagai
> database", padahal Google Sheet yang lambat adalah salah satu
> masalah utama yang ingin diselesaikan. Bagian ini mengklarifikasi
> keputusan tersebut.

**Keputusan:** Google Sheets digunakan sebagai **data store fase MVP**,
bukan solusi permanen jangka panjang, dengan batasan berikut:

-   Batas volume data aktif: maksimum **±20.000 baris** pada sheet
    `LongTail` sebelum evaluasi migrasi wajib dilakukan.
-   ~~Data yang sudah **Clear TTD lebih dari 30 hari** diarsipkan
    otomatis ke sheet terpisah (`LongTail_Archive`).~~ **DIGANTI di
    v1.3** oleh mekanisme **Auto-Close saat import** (lihat Bagian 7.4):
    paket tidak lagi diarsipkan berdasarkan umur, melainkan **saat
    paket hilang dari tarikan JMS** pada import berikutnya. `LongTail`
    aktif otomatis hanya berisi paket yang masih longtail di JMS,
    sehingga tetap ringan tanpa perlu ambang 30 hari.
-   Jika volume harian/mingguan melebihi kapasitas Google Sheets API
    (rate limit) atau waktu respons dashboard > 3 detik, tim wajib
    mengevaluasi migrasi ke database relasional (misal PostgreSQL/
    Supabase) sebagai Fase 2.
-   Keputusan ini harus disetujui stakeholder sebelum development
    dimulai, karena berdampak pada estimasi effort jangka panjang.

------------------------------------------------------------------------

# 4. Teknologi

## Frontend

-   Next.js
-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui
-   TanStack Table
-   SheetJS (xlsx)
-   React Query

Deploy: Vercel

## Backend

-   Google Apps Script (REST API layer)
-   Google Sheets (data store fase MVP, lihat Bagian 3)

## Autentikasi (Baru)

-   Login menggunakan **Google Workspace SSO** (akun email perusahaan),
    dibatasi domain internal.
-   Session token disimpan di HttpOnly cookie, expired otomatis
    setelah 8 jam idle.
-   Role (Admin Cabang / Admin DP) ditentukan dari data di sheet
    `Users`, bukan dari klaim sisi client.

------------------------------------------------------------------------

# 5. Hak Akses

## Admin Cabang

-   Dashboard
-   Import Long Tail
-   Data Long Tail
-   Master User
-   Master Drop Point
-   Master Feedback
-   Riwayat Import

## Admin DP

-   Dashboard
-   Feedback Long Tail
-   Riwayat Feedback
-   Profile

Admin DP hanya dapat melihat data sesuai Drop Point masing-masing.
Pembatasan ini ditegakkan di **level API** (backend memvalidasi DP milik
user), bukan hanya di UI.

------------------------------------------------------------------------

# 6. Flow Sistem

``` text
JMS
↓
Download Excel (5–6 File H-20)
↓
Multi Upload
↓
Merge Data
↓
Remove Duplicate Waybill (dalam file & terhadap data existing, lihat Bagian 7.1)
↓
Auto Mapping Header (sepenuhnya otomatis, lihat Bagian 7.2)
↓
Preview
↓
Import ke Google Sheets (dengan locking, lihat Bagian 7.3)
↓
Admin DP Mengisi Feedback (dengan conflict handling, lihat Bagian 9.4)
↓
Dashboard Update Otomatis
```

*Catatan: "H-20" merujuk pada siklus penarikan data 20 hari sebelum
batas waktu retur/proses long tail berikutnya — mohon dikonfirmasi ke
tim operasional agar didefinisikan secara eksplisit di dokumen final.*

------------------------------------------------------------------------

# 7. Import Long Tail

Admin Cabang dapat meng-upload banyak file Excel sekaligus.

Fitur:

-   Multi Upload
-   Drag & Drop
-   Merge seluruh file
-   Remove Duplicate berdasarkan Waybill
-   Auto Mapping Header
-   Preview sebelum Import
-   Batch Import
-   Riwayat Import

## 7.1 Penanganan Duplikat Lintas Batch (Baru)

Jika waybill yang diupload sudah ada di database dari batch import
sebelumnya (paket lama yang belum Clear TTD):

-   Sistem **tidak membuat baris baru**, melainkan meng-update field
    yang berubah (status terakhir, waktu sampai, dsb.), sambil
    mempertahankan histori feedback yang sudah ada.
-   Jika waybill sudah **Clear TTD** namun muncul lagi di file baru,
    sistem menandai sebagai *"Perlu Review"* dan tidak menimpa status
    Clear TTD secara otomatis.
-   Setiap update dari proses ini dicatat di Activity Log (Bagian 12).

## 7.2 Auto Mapping Header (direvisi: tanpa UI mapping manual)

-   Pemetaan kolom **sepenuhnya otomatis** (`autoDetectMapping`,
    alias-based) — tidak ada lagi langkah/UI mapping manual di wizard
    Import. Keputusan ini diambil setelah deteksi otomatis terbukti
    stabil & akurat selama pemakaian nyata, sehingga langkah manual
    dianggap beban tambahan yang tidak perlu bagi user.
-   Jika kolom wajib (No. Waybill) **tidak** berhasil terdeteksi
    otomatis pada suatu file, file tersebut **dilewati** dari proses
    gabung/import (tidak menghalangi file lain dalam batch yang sama)
    dan ditandai dengan peringatan di langkah Upload File, meminta
    user memeriksa nama header pada file tsb lalu mengunggah ulang.
-   Fitur simpan/muat template mapping (backend `/api/import/templates`)
    tetap ada di data model untuk kemungkinan pemakaian di masa depan,
    namun tidak lagi diekspos di UI Import karena tidak ada lagi titik
    mapping manual untuk disimpan.

## 7.3 Error Handling & Partial Failure (Baru; direvisi v1.3)

-   **Parsing & mapping** (format rusak, header tidak dikenali) tetap
    diproses **independen per file** — 1 dari 6 file gagal dibaca tidak
    menghalangi file lainnya untuk dipetakan dan disiapkan.
-   **Submit ke server SEBALIKNYA digabung jadi satu batch** (bukan lagi
    satu panggilan per file): seluruh file yang sudah siap ("Ready")
    di-*merge* + dedup by-waybill dulu (baris belakangan menang untuk
    waybill yang sama), baru dikirim sekali sebagai satu tarikan. Ini
    **wajib** sejak Auto-Close (Bagian 7.4): Auto-Close membaca "waybill
    yang tidak muncul di tarikan yang baru diimport" untuk menentukan
    apa yang diarsipkan. Kalau file dikirim satu-satu, server hanya
    melihat isi FILE YANG SEDANG diproses sebagai tarikan hari itu —
    waybill dari file yang sudah diimport sebelumnya (mis. beda DP)
    akan tampak "hilang dari tarikan" dan salah diarsipkan. Menggabungkan
    dulu memastikan Auto-Close melihat seluruh tarikan (semua file)
    sekaligus. Konsekuensinya: submit kini **all-or-nothing** untuk
    batch gabungan — gagal, seluruh batch gagal dan bisa diulang lewat
    tombol Import yang sama (bukan retry per-file).
-   Selama proses Import berjalan, sistem menggunakan **lock** (mis.
    `LockService` pada Google Apps Script) agar tidak ada proses tulis
    lain (termasuk Auto Save feedback) yang bentrok ke sheet yang sama
    di waktu bersamaan.

## 7.4 Auto-Close Paket yang Hilang dari Tarikan (Baru v1.3)

**Menggantikan** aturan arsip "Clear TTD > 30 hari" (Bagian 3). Setiap
hari Admin Cabang meng-import file tarikan JMS **per DP**, dan file itu
**hanya** berisi paket yang **masih** berstatus longtail di JMS. Maka
waybill yang kemarin ada di `LongTail` tetapi **tidak muncul lagi** di
file hari ini menandakan JMS sudah tidak menganggapnya longtail.

Setelah sebuah file berhasil diimport untuk DP tertentu, sistem
merekonsiliasi **scope per DP** (DP lain yang tidak ikut diimport hari
itu tidak tersentuh):

1.  Kumpulkan semua `No. Waybill` di file yang baru diimport.
2.  Ambil semua waybill `LongTail` **aktif** untuk **DP yang sama**.
3.  Untuk waybill yang ada di `LongTail` tetapi **tidak ada** di file
    baru, tentukan status berdasarkan kondisinya:
    -   **Sudah Clear TTD** → diarsipkan **apa adanya** dengan penanda
        `tipe_close = "Clear TTD"` (status & umur tidak diubah; data ini
        sudah valid dan pasti).
    -   **Belum Clear TTD** (masih On Delivery, Reschedule, PAKET
        BERMASALAH, CEK, dsb.) → `Status Terakhir` di-set **`CLOSE
        ALUR`**, **Umur Paket dibekukan** (sama seperti freeze saat Clear
        TTD, karena sudah tidak *actionable*), penanda `tipe_close =
        "Close Alur"`.
4.  Kedua kasus **dipindahkan** ke `LongTail_Archive` dan **dihapus**
    dari `LongTail` aktif → otomatis hilang dari halaman kerja harian.
5.  Setiap pemindahan dicatat ke `Activity_Log` dengan **Sumber
    Perubahan = "Auto-Close (tidak muncul di import)"**, Data Lama =
    status sebelumnya, Data Baru = `Clear TTD`/`CLOSE ALUR`, dan **User
    = Admin Cabang** yang menjalankan import (bukan dikosongkan — jejak
    pemicu tetap ada).

Waybill yang **masih** muncul di file (baik lama maupun benar-benar
baru) tetap mengikuti aturan dedup Bagian 7.1 — **tidak** terpengaruh
mekanisme ini.

**Pengaman file kurang lengkap:** karena file tarikan yang tidak lengkap
akan meng-Auto-Close banyak paket sekaligus, bila sebuah file berisi
**< 100 baris** sistem menampilkan **dialog konfirmasi (Lanjut / Batal)**
sebelum import diproses, mengingatkan admin bahwa paket DP yang tidak
tercantum akan di-Close & diarsipkan.

**Penelusuran:** paket yang sudah di-Auto-Close tetap dapat ditelusuri
lewat **Riwayat Feedback** (Activity_Log tidak pernah dihapus). Status
`CLOSE ALUR` ditampilkan sebagai badge **terpisah** dari `Clear TTD`
supaya Admin bisa membedakan paket yang benar-benar selesai vs yang
sekadar hilang dari tarikan.

------------------------------------------------------------------------

# 8. Dashboard

## Dashboard Admin Cabang

### Summary Card

-   Total Paket
-   Sudah Feedback
-   Belum Feedback
-   Clear TTD
-   Belum Clear TTD
-   Progress Feedback (%)
-   Paket Tertua

### Chart

1.  Distribusi Feedback
    -   Clear TTD
    -   On Delivery
    -   Reschedule
    -   Penerima Tidak Di Tempat
    -   Alamat Tidak Ditemukan
    -   Lainnya

2.  Statistik Aging Paket
    -   Hari ke-1
    -   Hari ke-2
    -   Hari ke-3
    -   Hari ke-4
    -   Hari ke-5
    -   Hari ke-6
    -   Hari ke-7+

3.  Progress per Drop Point

4.  Progress per Sprinter Delivery

### Monitoring DP

| DP | Total Paket | Sudah Feedback | Belum Feedback | Clear TTD | >3 Hari | Progress | Last Update |
|----|---|---|---|---|---|---|---|

## Dashboard Admin DP

### Summary Card

-   Total Paket
-   Sudah Feedback
-   Belum Feedback
-   Clear TTD
-   Belum Clear TTD
-   Paket >3 Hari
-   Progress Hari Ini

Chart: Distribusi Feedback, Statistik Aging Paket

------------------------------------------------------------------------

# 9. Halaman Feedback

Tabel dibuat menyerupai Google Sheet.

Kolom: No. Waybill, Status Terakhir, Alasan Paket Bermasalah, DP Sampai,
Waktu Sampai, Umur Paket, Sprinter Delivery, COD, Delivery Attempt,
Feedback, **Log Feedback** *(baru — lihat 9.0)*.

## 9.0 Log Feedback (Baru)

Prinsip: **1 waybill tetap 1 baris**. Riwayat feedback harian tidak
dibuat sebagai baris/kolom baru, melainkan **ditambahkan sebagai baris
teks baru di dalam satu sel** kolom `Log Feedback`, dipisah tanggal.

Contoh isi sel `Log Feedback` untuk satu waybill setelah 3 hari
follow-up:

``` text
12/07/26 : Reschedule waktu pengiriman
13/07/26 : Penerima Tidak Di Tempat
14/07/26 : Diterima penerima
```

**Cara kerja:**

1.  Saat Admin DP submit feedback baru untuk waybill yang belum Clear
    TTD, sistem membaca isi sel `Log Feedback` yang sekarang.
2.  Sistem menambahkan satu baris baru di **akhir teks** dengan format
    `DD/MM/YY : Feedback`, dipisah karakter newline — isi lama tidak
    pernah dihapus/ditimpa.
3.  Sel ditulis ulang dengan gabungan teks lama + baris baru tersebut.
4.  Kolom `Feedback` (isian terkini) pada baris yang sama ikut
    ter-update. `Status Terakhir` **TIDAK** ikut berubah — kolom itu
    murni data hasil tarikan Excel (Bagian 7), hanya berubah lewat
    import berikutnya (atau Auto-Close, Bagian 7.4), tidak pernah lewat
    submit feedback. `Umur Paket` tetap dihitung live dari `Waktu
    Sampai` (Bagian 9.1) — feedback tidak memengaruhinya, kecuali
    membekukannya saat Clear TTD.

**Yang dilihat user:** hanya kolom `Log Feedback` di atas — rapi, satu
sel, gampang dibaca sekilas, tanpa perlu buka sheet/tab lain.

**Di belakang layar (tidak terlihat user):** setiap penambahan baris
log ini **juga** dicatat sebagai satu baris terstruktur di sheet
tersembunyi `Activity_Log` (lihat Bagian 13 & 14), dengan kolom
terpisah (Tanggal, Waybill, Attempt ke-, Feedback, Admin DP). Sheet ini
murni untuk kebutuhan mesin — Dashboard, KPI, dan statistik per jenis
feedback (Bagian 8, 15) dihitung dari sini, bukan dengan mem-parsing
teks di kolom `Log Feedback`. User tidak pernah membuka atau mengedit
`Activity_Log` secara langsung.

## 9.1 Umur Paket

Dihitung otomatis, **live** (bukan nilai beku dari saat import), sebagai
selisih **tanggal kalender** (zona Jakarta/WIB) antara hari ini dan
tanggal `Waktu Sampai` — bukan `floor(jam berlalu / 24)`. Contoh: paket
sampai 28/07 (jam berapa pun) dan hari ini 30/07 -> Umur = 2, sejak
tengah malam WIB tanpa perlu menunggu genap 48 jam sejak jam `Waktu
Sampai`-nya. Umur = 0 berarti sampai hari ini.

**Aturan penghentian hitungan (Baru):** perhitungan umur **berhenti**
pada saat status diubah menjadi **Clear TTD**; nilai umur dibekukan
(*frozen*) pada angka saat Clear TTD tercatat, dan tidak terus
bertambah setelahnya. Ini penting karena Aging adalah indikator
prioritas utama sistem (lihat Bagian 15). *(v1.3)* Umur juga dibekukan
saat paket di-**Auto-Close** menjadi **`CLOSE ALUR`** (Bagian 7.4),
karena paket tersebut sudah tidak *actionable*.

**Nilai `Status Terakhir` (direvisi):** kolom ini murni data hasil
tarikan Excel (Bagian 7) — **hanya** berubah lewat import berikutnya
atau lewat Auto-Close otomatis (`CLOSE ALUR`, Bagian 7.4), **tidak
pernah** lewat submit feedback manual, termasuk saat admin menandai
Clear TTD. Status "Clear TTD" sebuah paket dibaca dari kolom
`Feedback` (baris mengandung kata "TTD" — lihat `isClearTTD`), bukan
dari `Status Terakhir`; badge/warna aging & pembekuan umur mengikuti
`Feedback`, bukan `Status Terakhir`. `CLOSE ALUR` tetap satu-satunya
nilai yang **diset otomatis oleh sistem** ke `Status Terakhir`, khusus
saat Auto-Close (Bagian 7.4). Paket dengan `Feedback` Clear TTD atau
`Status Terakhir` `CLOSE ALUR` berada di arsip, bukan di daftar kerja
aktif.

### Warna Aging

| Umur | Warna |
|---|---|
| 1 Hari | Hijau |
| 2 Hari | Kuning |
| >= 3 Hari | Merah |

Default sorting berdasarkan umur paket tertua.

## 9.2 Fitur Tabel

-   Sticky Header
-   Search
-   Filter
-   Sorting
-   Pagination
-   Auto Save
-   Keyboard Friendly
-   Highlight Baris Aktif
-   Enter berpindah ke baris berikutnya

## 9.3 Notifikasi Aging (Baru)

-   Sistem mengirim indikator/alert (badge di Dashboard, dan opsional
    email harian) untuk paket yang mencapai umur **>= 3 hari** dan
    belum ada feedback, ditujukan ke Admin DP terkait dan Admin
    Cabang.

## 9.4 Penanganan Konflik Edit Bersamaan (Baru)

-   Saat Admin DP membuka baris untuk edit, baris ditandai
    *"sedang diedit oleh [nama user]"* bagi user lain yang membuka
    halaman yang sama (soft-lock, bukan hard-lock).
-   Auto Save menggunakan **optimistic locking**: jika data di server
    sudah berubah sejak baris terakhir dimuat, sistem menampilkan
    peringatan dan meminta user me-refresh baris sebelum menyimpan,
    agar tidak menimpa perubahan orang lain secara diam-diam.

------------------------------------------------------------------------

# 10. Master Feedback

Admin Cabang mengelola daftar Master Feedback.

Contoh:

-   CLEAR TTD
-   ON DELIVERY
-   RESCHEDULE WAKTU PENGIRIMAN
-   PENERIMA TIDAK DI TEMPAT
-   ALAMAT TIDAK DITEMUKAN

------------------------------------------------------------------------

# 11. Favorite Feedback

Setiap Admin DP dapat membuat daftar feedback favorit.

Dropdown akan menampilkan Favorite Feedback terlebih dahulu kemudian
Master Feedback. Mendukung pencarian cepat (type to search).

------------------------------------------------------------------------

# 12. Master User & Master Drop Point (Diperjelas)

## Master User

Field minimum: Nama, Email (akun SSO), Role (Admin Cabang/Admin DP),
Drop Point terkait (untuk Admin DP), Status Aktif/Nonaktif.

-   Hanya Admin Cabang yang dapat menambah/menonaktifkan user.
-   User baru wajib dikaitkan ke minimal satu Drop Point sebelum bisa
    login sebagai Admin DP.

## Master Drop Point

Field minimum: Kode DP, Nama DP, Wilayah/Cabang, Status Aktif/Nonaktif.

------------------------------------------------------------------------

# 13. Riwayat (Activity_Log)

`Activity_Log` adalah sheet **tersembunyi**, tidak dibuka/diedit user,
berfungsi ganda:

1.  **Audit trail** — mencatat setiap perubahan data hasil import
    (Bagian 7.1) maupun perubahan lain di luar feedback harian.
2.  **Sumber data terstruktur untuk Log Feedback** (Bagian 9.0) —
    setiap kali admin submit feedback, satu baris ditambahkan di sini
    secara paralel dengan update sel `Log Feedback` di sheet
    `LongTail`.

Kolom minimum:

-   User (Admin DP yang input)
-   DP
-   Waybill
-   Attempt ke- (increment otomatis per waybill)
-   Data Lama (status/feedback sebelumnya)
-   Data Baru (status/feedback saat ini)
-   Tanggal
-   Jam
-   Sumber perubahan (Manual Feedback / Auto-update Import / **Auto-Close
    (tidak muncul di import)** *(v1.3)*)

Dari sheet inilah Dashboard menghitung metrik seperti Progress Hari
Ini, Distribusi Feedback, dan rata-rata jumlah attempt sebelum Clear
TTD (Bagian 8, 15) — **tanpa** perlu mem-parsing teks di kolom
`Log Feedback` yang sifatnya untuk tampilan, bukan untuk kalkulasi.

------------------------------------------------------------------------

# 14. Struktur Google Sheets

-   Users
-   LongTail — 1 baris per waybill, termasuk kolom `Log Feedback`
    yang tampil ke user (Bagian 9.0)
-   LongTail_Archive — tujuan paket yang di-Auto-Close saat import
    (Bagian 7.4); punya kolom `tipe_close` (`Clear TTD` | `Close Alur`)
    utk membedakan asal penutupan *(v1.3; menggantikan aturan arsip
    30-hari)*
-   Master Feedback
-   Favorite Feedback
-   Import Batch
-   Activity_Log — **tersembunyi**, sumber data terstruktur untuk
    Dashboard/KPI & audit trail (Bagian 13); tidak dibuka/diedit user

------------------------------------------------------------------------

# 15. Success Metrics / KPI (Baru)

| Metrik | Baseline (Google Sheet) | Target Setelah LTMS |
|---|---|---|
| Waktu proses import per batch | ~30–60 menit (manual copy-paste) | < 5 menit |
| Kesalahan input data (salah copy) | Belum terukur, dilaporkan sering terjadi | Mendekati 0 (tervalidasi sistem) |
| Progress feedback harian per DP | Sulit dipantau real-time | Terlihat real-time di Dashboard |
| Paket >3 hari belum Clear TTD | Tidak termonitor otomatis | Termonitor & muncul alert < 1 hari sejak melewati ambang |

*Catatan: Angka baseline perlu dikonfirmasi ke tim operasional agar
target realistis dan bisa diukur pasca-launch.*

------------------------------------------------------------------------

# 16. Out of Scope (MVP) — Baru

Untuk mengelola ekspektasi, hal berikut **tidak** termasuk dalam MVP:

-   Migrasi penuh ke database relasional (baru dipertimbangkan jika
    ambang di Bagian 3 terlampaui).
-   Notifikasi via WhatsApp/SMS (MVP hanya in-app badge + email
    opsional).
-   Integrasi otomatis/API langsung ke JMS (MVP tetap berbasis
    export/upload manual file Excel).
-   Manajemen multi-level approval untuk perubahan Master Feedback.
-   Aplikasi mobile native (MVP web-responsive saja).

------------------------------------------------------------------------

# 17. MVP

-   Login (Google Workspace SSO)
-   Dashboard Admin Cabang
-   Dashboard Admin DP
-   Multi Upload Excel (mapping otomatis penuh & partial failure
    handling)
-   Merge Data
-   Remove Duplicate (dalam file & lintas batch)
-   Auto Mapping Header
-   Import Google Sheets (dengan locking)
-   Data Long Tail
-   Aging Paket (dengan aturan freeze saat Clear TTD)
-   Statistik Aging 1–7 Hari
-   Feedback Spreadsheet (dengan optimistic locking)
-   Favorite Feedback
-   Master Feedback
-   Master User & Master Drop Point
-   Search & Filter
-   Auto Save
-   Riwayat Perubahan
-   Notifikasi Aging (badge dashboard)

------------------------------------------------------------------------

# 18. Catatan Pengembangan

-   Fokus utama sistem adalah monitoring paket yang belum Clear TTD.
-   Aging paket menjadi indikator prioritas utama; hitungan berhenti
    setelah Clear TTD (Bagian 9.1).
-   Tampilan tabel dipertahankan menyerupai Google Sheet agar operator
    tidak perlu beradaptasi.
-   Dashboard dibuat sederhana namun informatif.
-   Frontend menggunakan Next.js di Vercel.
-   Backend menggunakan Google Apps Script dan Google Sheets sebagai
    solusi fase MVP dengan batas volume data yang disepakati
    (Bagian 3) — bukan komitmen jangka panjang tanpa batas.

------------------------------------------------------------------------

# Lampiran A — Changelog v1.0 → v1.1

| No | Perubahan | Alasan |
|---|---|---|
| 1 | Menambahkan Bagian 3: Keputusan Arsitektur Data | Menyelesaikan kontradiksi "Sheets lambat" vs "tetap pakai Sheets" |
| 2 | Menambahkan metode autentikasi (SSO) | Sebelumnya tidak dijelaskan sama sekali |
| 3 | Menambahkan 7.1–7.3: dedup lintas batch, fallback mapping, error handling | Gap kritis di alur import |
| 4 | Menambahkan locking (import) & optimistic locking (feedback) | Mencegah race condition multi-user pada Google Sheets |
| 5 | Menambahkan aturan freeze Umur Paket saat Clear TTD | Definisi sebelumnya ambigu |
| 6 | Menambahkan notifikasi aging (9.3) | Tujuan monitoring belum didukung mekanisme alert |
| 7 | Memperjelas Master User & Master Drop Point | Field dan aturan sebelumnya tidak ada |
| 8 | Menambahkan Success Metrics/KPI (Bagian 15) | Tidak ada tolok ukur keberhasilan proyek |
| 9 | Menambahkan Out of Scope (Bagian 16) | Mengelola ekspektasi stakeholder |
| 10 | Menambahkan kebijakan arsip data (LongTail_Archive) | Antisipasi Google Sheets melambat lagi |
| 11 *(v1.2)* | Mengganti konsep sheet-per-hari dengan kolom `Log Feedback` (1 waybill = 1 baris, riwayat menumpuk dalam satu sel) | Menjaga kebiasaan Admin DP melihat progress harian tanpa duplikasi data status paket |
| 12 *(v1.2)* | Menambahkan `Activity_Log` tersembunyi sebagai sumber data terstruktur di balik `Log Feedback` | Dashboard/KPI tetap bisa dihitung otomatis tanpa parsing teks bebas |
| 13 *(v1.3)* | Mengganti arsip "Clear TTD > 30 hari" dengan **Auto-Close saat import** (Bagian 7.4) | Paket yang hilang dari tarikan JMS di-close real-time; `LongTail` aktif selalu mencerminkan kondisi JMS terkini |
| 14 *(v1.3)* | Menambahkan status **`CLOSE ALUR`** + kolom `LongTail_Archive.tipe_close` | Membedakan paket yang benar-benar selesai (`Clear TTD`) vs yang sekadar hilang dari tarikan |
| 15 *(v1.3)* | Umur Paket ikut dibekukan saat Auto-Close `CLOSE ALUR` | Paket sudah tidak *actionable*, aging tak boleh terus berjalan |
| 16 *(v1.3)* | Dialog konfirmasi import file < 100 baris (Bagian 7.4) | Mencegah Auto-Close massal akibat file tarikan tidak lengkap |
| 17 *(v1.3)* | Event Auto-Close dicatat ke `Activity_Log` & tampil di Riwayat Feedback | Paket terarsip tetap dapat ditelusuri; jejak Admin pemicu import tersimpan |
| 18 *(v1.3)* | Multi-file upload digabung jadi satu batch submit (bukan lagi 1 panggilan server per file), Bagian 7.3 | File dikirim satu-satu membuat Auto-Close (7.4) salah mengarsipkan waybill dari file yang sudah diimport sebelumnya, seolah "hilang dari tarikan" |
| 19 *(v1.3)* | Menghapus langkah/UI mapping manual dari wizard Import (Bagian 7.2); file yang kolom wajibnya gagal terdeteksi otomatis kini dilewati dengan peringatan, bukan diarahkan ke UI mapping | Deteksi otomatis terbukti stabil & akurat saat pemakaian nyata; langkah manual jadi beban tambahan yang tak perlu |
| 20 *(v1.3)* | Umur Paket dihitung ulang sebagai selisih tanggal kalender Jakarta (bukan `floor(jam berlalu / 24)`), dan parsing `Waktu Sampai` diperbaiki agar selalu dibaca sbg jam dinding Jakarta (Bagian 9.1) | Umur tidak naik tepat waktu di pergantian hari — paket yg sampai kemarin sore masih terhitung "1 Hari" alih-alih "2 Hari" keesokan paginya |
| 21 *(v1.3)* | `Status Terakhir` tidak lagi ikut ditimpa nilai `Feedback` saat submit feedback manual, termasuk saat Clear TTD (Bagian 9.0 & 9.1) | Kolom itu harus murni cerminan data tarikan Excel/Auto-Close; status Clear TTD sudah cukup dibaca dari `Feedback` (`isClearTTD`), tidak perlu menimpa `Status Terakhir` |
