# Product Requirements Document (PRD)

# LongTail Dashboard Management System (LTMS)

**Version:** 2.0\
**Status:** Draft for Review\
**Perubahan dari v1.2/v1.3 → v2.0:** Dokumen ditulis ulang total berdasarkan **audit kode & database aktual** (bukan lagi rencana/diskusi), setelah sistem berpindah penuh dari Google Sheets/Apps Script ke Next.js + Supabase PostgreSQL, autentikasi berpindah dari Google SSO ke NIK+Password, dan hierarki role berkembang dari 2 menjadi 6 level. Lihat **Bagian 12 — Lampiran: Changelog v1.0 → v2.0** untuk daftar lengkap perubahan per keputusan.

------------------------------------------------------------------------

# 1. Latar Belakang & Tujuan

## 1.1 Latar Belakang

Sebelum LTMS dibangun, proses Long Tail dikelola manual lewat Google Sheet:

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

Permasalahan yang mendorong pembangunan LTMS:

-   Copy-paste manual, memakan waktu, dan rawan salah copy.
-   Sulit memonitor progres tiap Drop Point.
-   Tidak ada dashboard monitoring.
-   Google Sheet melambat saat data bertambah banyak.

Tujuan utama Long Tail tetap sama sejak awal: **memonitor paket yang belum Clear TTD**, mengetahui **umur (aging) paket**, dan memastikan setiap paket memiliki feedback hingga selesai.

## 1.2 Tujuan

Membangun aplikasi web internal untuk membantu jajaran operasional (kini mencakup Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota, SPV Drop Point, dan Admin DP — lihat Bagian 4) mengelola Long Tail secara cepat, mudah, dan terstruktur.

Target utama (tercapai, lihat Bagian 6-9 untuk detail implementasi):

-   Menghilangkan proses copy-paste manual → digantikan wizard Import Excel dengan auto-mapping header.
-   Mempercepat proses import data → submit satu batch gabungan, bukan lagi satu-satu.
-   Mempermudah input feedback → tabel ala spreadsheet dengan auto save & optimistic locking.
-   Monitoring paket yang belum Clear TTD → Dashboard real-time + badge aging.
-   Monitoring umur paket (Aging) → dihitung live per hari kalender Jakarta, freeze otomatis saat Clear TTD.
-   Menyediakan dashboard monitoring progress → per Cabang, per DP, per Sprinter, plus "keadaan tanggal X" via snapshot harian.
-   *(Berkembang di luar cakupan awal, lihat Bagian 5, 8, 9)* Kontrol akses granular per menu (Role & Akses), Monitoring Delivery terhadap data JMS, dan Link Berbagi Laporan publik.

------------------------------------------------------------------------

# 2. Arsitektur Sistem

## 2.1 Arsitektur Saat Ini

-   **Frontend & Backend:** Next.js 16 (App Router, Turbopack), TypeScript, TanStack React Query, Tailwind CSS + shadcn/ui. API dilayani lewat Next.js API routes/Server Actions memanggil layer `lib/data/supabase/*.ts` — tidak ada lagi backend terpisah.
-   **Database:** **Supabase PostgreSQL sepenuhnya**, diakses langsung lewat `supabase-js` (tanpa ORM). Kontrol akses (mis. Admin DP hanya boleh melihat data DP-nya) ditegakkan di **API layer** menggunakan `service_role` key; **RLS sengaja OFF** — didokumentasikan eksplisit di `schema.sql` sebagai peningkatan yang bisa diaktifkan setelah stabil, bukan kelalaian.
-   **Autentikasi:** NextAuth v5 (Auth.js), provider `Credentials` (NIK+Password) — lihat Bagian 3.
-   **Testing:** Node built-in test runner, pola *fake-DB-boundary* (`mock.module()` pada `./client` + `fakeDbFactory`) — tidak menyentuh Supabase asli saat test.
-   **Deploy:** Vercel.

## 2.2 Riwayat Migrasi (Historis)

Fase awal LTMS (MVP) sempat memakai **Google Sheets sebagai data store** dan **Google Apps Script sebagai REST API layer** (lihat PRD v1.0–v1.2), dengan alasan mempercepat time-to-market sambil menunda keputusan database relasional. Keputusan ini **sudah sepenuhnya digantikan**:

-   **Cutover ke Supabase** sebagai satu-satunya backend selesai pada **26 Juli 2026** (commit `79de30b`, "decommission Apps Script — Supabase jadi satu-satunya backend").
-   Tidak ada lagi folder/kode Google Apps Script di repository aktif — seluruh referensi Google Sheets sebagai arsitektur berjalan sudah tidak berlaku, murni catatan sejarah.
-   Batas volume (~20.000 baris) dan evaluasi migrasi yang disyaratkan PRD v1.2 Bagian 3 **sudah tidak relevan** — PostgreSQL tidak punya batasan praktis yang sama seperti Google Sheets API.

------------------------------------------------------------------------

# 3. Autentikasi

## 3.1 Metode Login

-   **NIK + Password** (provider `Credentials` NextAuth) adalah **satu-satunya** cara login. **Google OAuth sudah dihapus total** (bukan dual-mode) — tombol Google & provider dinonaktifkan pada **31 Juli 2026** (commit `f9142df`).
-   Password disimpan sebagai hash `scrypt` (`"salt:hash"`, kolom `users.password_hash`), tidak pernah plaintext.
-   `users.email` dipertahankan sebagai primary key (peninggalan era Google) tetapi **bukan lagi jalur login** — `users.nik` (unique, nullable selama transisi) adalah identifier login yang sesungguhnya sekarang.
-   Sesi "setengah jadi" (mis. password salah lalu halaman di-refresh) ditolak eksplisit — `jwt`/session callback mensyaratkan `role` terisi penuh sebelum sesi dianggap valid, mencegah bypass login lewat cookie tidak sempurna.

## 3.2 Tipe Akun

-   `users.tipe_akun`: `'individual'` (default) atau `'general'`.
-   Akun **General per Drop Point** sudah dibangun — dipakai saat satu DP memakai satu akun bersama, bukan akun per-orang. `nama_tampilan` (kolom terpisah dari `nama`) diisi format `"DP <KODE_DP>"` untuk akun general, dipakai sebagai identitas penulis di `activity_log` supaya jejak audit tetap jelas meski akunnya dipakai bergantian.

## 3.3 Keamanan Login

-   **Rate limiting berbasis DB** (tabel `login_attempts`, bukan in-memory — konsisten lintas instance serverless): maksimum 5 percobaan gagal per 15 menit per NIK, mengunci sementara via `locked_until`. Login sukses mereset baris.
-   Role (dan Drop Point terkait) ditentukan sepenuhnya dari tabel `users` di server, tidak pernah dipercaya dari klaim sisi client.

------------------------------------------------------------------------

# 4. Struktur Organisasi & Hierarki Role

## 4.1 Enam Role Final

`users.role` (CHECK constraint) mendukung 6 nilai:

| Role | Kelompok Akses | Cakupan Data |
|---|---|---|
| Super Admin | Full access | Semua DP, satu-satunya yang bisa mengatur Role & Akses ke-5 role lain |
| Admin Cabang | Full access | Semua DP |
| Manager Kota | Full access | Semua DP |
| Asisten Manager Kota | Full access | Semua DP |
| SPV Drop Point | Terbatas | DP yang disupervisi (bisa >1) |
| Admin DP | Terbatas | 1 DP miliknya |

`FULL_ACCESS_ROLES` (`lib/roles.ts`) = Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota — **cakupan data & menu-nya identik** (semua DP, menu utama + Master Data + Laporan + Pengaturan sama persis), tidak dibedakan berdasar jabatan di level fitur operasional. Perbedaan sesungguhnya di antara ke-4 role ini **hanya** di Role & Akses (Bagian 5): cuma Super Admin yang bisa mengelola kartu jabatan Admin Cabang/Manager Kota/Asisten Manager Kota/SPV Drop Point/Admin DP; tiga role full-access lain hanya bisa mengelola SPV Drop Point/Admin DP.

## 4.2 Jabatan vs Role

Tabel `jabatan` (6 baris, seed tetap) menormalkan label organisasi dengan `id` + `tingkat` (1–6), dipakai sebagai sumber dropdown di form Tambah/Edit User (`users.jabatan_id`, `NOT NULL`, FK ke `jabatan`). Kolom `users.role` (text) **tetap dipertahankan** sebagai fallback/cross-check selama masa transisi — keduanya harus konsisten, `jabatan_id` adalah representasi normalisasi dari `role` yang sama, bukan sumber kebenaran terpisah.

## 4.3 Cabang (Kota) — Label Organisasi

Tabel `cabang` (PK `kode_kota`) menyimpan `manager_kota_user_id`/`asisten_manager_user_id` sebagai **penunjuk label**, bukan constraint akses — field ini bisa menunjuk ke akun `users` mana pun yang aktif, dan **tidak mengubah cakupan data** akun tersebut (tetap mengikuti Bagian 4.1: full access = semua DP). Field ini dipakai murni untuk menampilkan "siapa Manager Kota/Asisten Manager di Kota X" di UI Master Cabang, dan untuk resolusi label konteks read-only di Role & Akses (Bagian 5.3).

## 4.4 SPV Drop Point — Cakupan Multi-DP

SPV Drop Point adalah satu-satunya role non-full-access yang bisa mensupervisi **lebih dari satu DP** sekaligus (`master_drop_point.spv_drop_point_user_id`). Seluruh scoping data (Dashboard, Feedback, Monitoring Delivery) memakai `resolveScopedDps(actor)` untuk mengambil daftar DP yang disupervisi, divalidasi server-side — tidak pernah menerima daftar DP mentah dari client.

------------------------------------------------------------------------

# 5. Role & Akses

## 5.1 Struktur Data

-   `role_permissions` (PK `role, menu_key`) — default akses per role.
-   `user_permissions` (PK `user_id, menu_key`) — override per akun individual, menimpa default **hanya** untuk akun itu.
-   Resolusi (`hasPermission()`/`getEffectiveMenuAccess()`, `lib/data/supabase/permissions.ts`): `user_permissions` menang jika ada barisnya (termasuk bila nilainya `false`) → fallback ke `role_permissions` → fallback terakhir `true` (jaring pengaman jika seed somehow tidak lengkap, mencegah lockout massal).
-   **Super Admin** adalah **satu-satunya bypass permanen** — tidak pernah dicek ke DB, selalu `true` untuk semua menu.
-   Kelima role lain (Admin Cabang, Manager Kota, Asisten Manager Kota, SPV Drop Point, Admin DP) **semuanya dicek matrix secara nyata** — bypass grup full-access **sudah dihapus** (1 Agustus 2026, commit `b3fafb2`). Sebelum tanggal ini, toggle di UI untuk Admin Cabang/Manager Kota/Asisten Manager Kota tidak berefek apa pun (bypass masih aktif); sejak commit ini, toggle benar-benar menegakkan akses.

## 5.2 Siapa Mengatur Siapa

| Actor | Role yang bisa diatur | Jumlah kartu di Grid Jabatan |
|---|---|---|
| Super Admin | Admin Cabang, Manager Kota, Asisten Manager Kota, SPV Drop Point, Admin DP | 5 |
| Admin Cabang / Manager Kota / Asisten Manager Kota | SPV Drop Point, Admin DP saja | 2 (tidak berubah dari sebelumnya) |

Ketiga role full-access **tidak bisa** melihat/mengatur kartu role mereka sendiri (Admin Cabang/Manager Kota/Asisten Manager Kota) — itu privilese eksklusif Super Admin. Konstanta `ALL_MANAGEABLE_ROLES` (5, siapa saja yang "bisa diatur" total) sengaja dipisah dari `CABANG_MANAGEABLE_ROLES` (2, tetap, siapa yang boleh diatur oleh 3 role full-access non-Super-Admin) untuk mencegah drift antara dua cakupan yang berbeda tujuan ini.

## 5.3 Vocabulary Menu (15 menu_key) & Status Enforcement

Dari 15 `menu_key` yang tersedia di CHECK constraint, status penegakannya per **1 Agustus 2026**:

**6 menu_key sudah punya enforcement nyata** (dicek via `requirePermission()` di endpoint atau `getMyMenuAccess()` di halaman):

| menu_key | Ditegakkan di |
|---|---|
| `dashboard` | `getDashboard()`, `getDashboardSnapshot()` |
| `feedback_longtail_view` | `listLongTail()` |
| `feedback_longtail_edit` | `updateLongTail()` (submit feedback) |
| `riwayat_feedback` | `listRiwayatFeedback()` |
| `monitoring_delivery_cabang` | page-level gate, `monitoring-delivery/page.tsx` (mode Refine Total) |
| `monitoring_delivery_dp` | page-level gate, `monitoring-delivery/page.tsx` (mode per-Sprinter) |

**9 menu_key masih ter-seed tapi belum di-wire** (toggle di UI Role & Akses saat ini **tidak berefek** ke backend maupun frontend): `data_longtail`, `import_longtail`, `master_cabang`, `master_drop_point`, `master_feedback`, `user_management`, `riwayat_import`, `pengaturan`, `role_akses`. Rencana penuntasannya dicatat di **Bagian 11 — Utang Teknis**.

## 5.4 Sidebar

Sidebar (`lib/nav.ts` + `components/layout/sidebar.tsx`) menyembunyikan **total** item menu yang `enabled=false` untuk actor (bukan sekadar memblokir isinya setelah diklik) — memakai resolusi yang **sama persis** dengan backend (`getMyMenuAccess()`), dihitung sekali di Server Component sebelum render supaya menu yang dimatikan tidak sempat "kelihatan lalu hilang". Item tanpa `menuKey` (mis. Profil Saya, dan sebagian besar menu full-access yang belum ter-wire ke matrix) selalu tampil apa pun isi matrix-nya. Gap yang diketahui pada mekanisme ini dicatat di Bagian 11.

------------------------------------------------------------------------

# 6. Data Long Tail — Aturan Bisnis Inti

## 6.1 Dedup Lintas Batch & Dalam File

Import menggabungkan seluruh file yang siap ("Ready") menjadi satu batch submit (bukan satu panggilan server per file — wajib sejak Auto-Close, lihat 6.3), lalu deduplikasi via `Map<no_waybill, ...>` sebelum upsert: baris belakangan menang untuk waybill yang sama, baik duplikat dalam satu file maupun terhadap data `longtail` yang sudah ada (PK `no_waybill`). Setiap kemunculan berulang suatu waybill dalam file yang sama menaikkan `delivery_attempt`.

## 6.2 Freeze & Resume Umur Paket (Aging)

Umur dihitung **live**, sebagai selisih **tanggal kalender Jakarta (WIB)** antara hari ini dan `waktu_sampai` — bukan `floor(jam berlalu / 24)`. Perhitungan **dibekukan** (`umur_frozen`) saat status Clear TTD tercatat (`decideFeedbackTransition()`, `longtail-pure.ts`):

-   **Belum Clear TTD → jadi Clear TTD**: umur dibekukan pada angka saat itu.
-   **Sudah Clear TTD → dikoreksi ke status lain**: umur **dilepas dari beku dan resume live** dari `waktu_sampai` (bukan melanjutkan dari angka beku) — dicatat ke `activity_log` dengan sumber `"Koreksi Manual"`, Data Lama `"Clear TTD"`.
-   **Status Clear TTD tidak berubah** (tetap/masih bukan): `umur_frozen` **sengaja tidak disentuh**, mencegah bug laten "re-freeze di momen lebih baru" akibat admin sekadar mengedit teks feedback tanpa benar-benar mengoreksi status.

Warna badge aging: **1 hari = hijau, 2 hari = kuning, ≥3 hari = merah**; umur 0 (baru sampai hari ini) & paket beku tampil netral (`components/ui/aging-badge.tsx`).

## 6.3 Close Alur — Arsip Real-Time Berbasis Kehadiran Import

**Bukan lagi** arsip "Clear TTD > 30 hari" (mekanisme lama v1.0–v1.2). Setiap kali sebuah file berhasil diimport untuk suatu DP, sistem merekonsiliasi **scope per DP itu saja** (DP lain yang tidak ikut diimport tidak tersentuh):

-   Waybill yang **hilang** dari tarikan terbaru (tidak muncul di file yang baru diimport) untuk DP tersebut → di-close otomatis (`decideAutoClose()`/`planAutoClose()`, `longtail-pure.ts`).
-   **Sudah Clear TTD** → diarsipkan **apa adanya** (`tipe_close = 'Clear TTD'`), status & umur tidak diubah.
-   **Belum Clear TTD** → `status_terakhir` di-set `'CLOSE ALUR'`, umur dibekukan di nilai live saat itu, `tipe_close = 'Close Alur'` — dibedakan dari Clear TTD di badge & arsip supaya admin bisa membedakan paket yang benar-benar selesai vs sekadar hilang dari tarikan.
-   Dicatat ke `activity_log` dengan sumber `"Auto-Close (tidak muncul di import)"`.

## 6.4 Koreksi Clear TTD (Dedup Anomali)

Jika waybill yang **sudah** Clear TTD muncul lagi di tarikan baru dengan status tracking baru — bukti kuat admin salah menandai sebelumnya — sistem melakukan **koreksi otomatis**, bukan menandai "Perlu Review" pasif:

-   Field tracking (Status Terakhir, Waktu Sampai, DP Sampai, Sprinter Delivery, COD, Delivery Attempt, Alasan Paket Bermasalah) ditimpa data tarikan terbaru.
-   `umur_frozen` direset (resume live).
-   Feedback dikosongkan (wajib — seluruh klasifikasi Clear TTD di UI dibaca dari teks Feedback, bukan `umur_frozen`).
-   Dicatat ke `activity_log`: sumber `"Koreksi Otomatis (tidak konsisten dengan tarikan)"`, Data Lama `"Clear TTD"`.

------------------------------------------------------------------------

# 7. Dashboard & Statistik

## 7.1 Cakupan Data

Seluruh angka dihitung & di-scope **server-side** (`getDashboard()`, `lib/data/supabase/dashboard.ts`): Admin DP → DP-nya; SPV Drop Point → semua DP yang disupervisi (atau 1 DP jika difilter lewat kotak cakupan, tervalidasi terhadap `resolveScopedDps`); full access → semua DP atau 1 DP terpilih via filter Cakupan di sidebar.

## 7.2 Summary Card & Chart

-   **Summary**: Total Paket, Sudah/Belum Feedback, Clear TTD/Belum Clear TTD, Progress Feedback (%), Paket Tertua (+ nomor waybill-nya), Paket >3 Hari, Progress Hari Ini.
-   **Distribusi Feedback**: Clear TTD, On Delivery, Reschedule, Penerima Tidak Di Tempat, Alamat Tidak Ditemukan, Lainnya, Belum Feedback.
-   **Statistik Aging**: bucket Hari ke-1 s.d. ke-6, dan 7+.
-   **Progress per Drop Point** & **Progress per Sprinter Delivery**.

## 7.3 "Progress Hari Ini" vs "Sudah (Total)"

Dua metrik yang **sengaja berbeda cakupan waktu**, bukan bug:

-   **Progress Hari Ini** (kartu ringkasan): jumlah waybill dengan `activity_log` bersumber `"Manual Feedback"` **hari ini** (Jakarta) — kecepatan kerja harian.
-   **"Sudah (Total)"** (kolom tabel Progress per Drop Point): **cumulative** all-time, sama seperti "Sudah Feedback Keseluruhan" di ringkasan atas — coverage total, bukan kecepatan.

Kolom "Sudah (Total)" sempat keliru di-scope ke hari ini pada satu iterasi sebelumnya, lalu dicabut setelah dikonfirmasi ke lapangan bahwa definisi yang benar memang cumulative — lihat riwayat commit untuk detail insiden ini.

## 7.4 Dashboard "Keadaan Tanggal X" (Snapshot Harian)

`dashboard_snapshot` (PK `tanggal, scope`) diisi cron harian (~23:55 WIB) via `writeDailySnapshot()`, granularitas per-scope tunggal (`'ALL'` + satu baris per DP aktif) — **belum ada** agregat historis multi-DP. Implikasinya:

-   Admin DP & SPV Drop Point yang disupervisi tepat 1 DP → bisa lihat snapshot tanggal manapun.
-   SPV Drop Point yang mensupervisi >1 DP tanpa mempersempit ke 1 DP → fitur ini mengembalikan `null` (bukan menjumlahkan snapshot per-DP secara serampangan, karena field seperti progress% & paket tertua tidak valid jika sekadar dijumlah). Dashboard **live** (bukan snapshot) sudah benar mengagregasi real-time untuk kasus ini — keterbatasan hanya ada di fitur "keadaan tanggal X".

------------------------------------------------------------------------

# 8. Monitoring Delivery

Fitur terpisah dari Data Long Tail — mengolah laporan JMS (bukan data `longtail`), dengan **2 mode** menurut role:

| Mode | Role Pemilik | menu_key |
|---|---|---|
| **Refine Total** (per Drop Point) | Admin Cabang, Manager Kota, Asisten Manager Kota, Super Admin | `monitoring_delivery_cabang` |
| **Per-Sprinter** | SPV Drop Point, Admin DP | `monitoring_delivery_dp` |

## 8.1 Alur

1.  Upload file laporan JMS (`.xlsx`/`.xls`/`.csv`).
2.  Parsing otomatis: mode per-Sprinter menyaring baris berawalan **"Mtr"**; mode Refine Total merekap per Drop Point.
3.  Kalkulasi matriks: Jumlah Waybill Delivery, Tanda Terima, Belum Diterima, Paket Bermasalah, Presentase TTD.
4.  Input manual "Total Sampai" (generasi 2 langkah), lalu tabel diurutkan otomatis dari persentase TTD tertinggi ke terendah.
5.  Header tebal otomatis `MONITORING DELIVERY [NAMA DP]` mendeteksi nama DP akun.

## 8.2 Indikator Warna Presentase TTD

| Presentase TTD | Warna |
|---|---|
| ≥ 95% | Hijau |
| 90% – 94,9% | Kuning Muda |
| ≤ 90% | Merah |

## 8.3 Copy as Image

Tombol Copy as Image (`html-to-image`) menghasilkan `ClipboardItem` dengan **3 payload sekaligus** (PNG, teks, tabel HTML) — otomatis terbaca sebagai gambar saat di-paste ke aplikasi chat (WhatsApp) dan sebagai tabel saat di-paste ke Spreadsheet/Excel. Menggunakan `ClipboardItem` berbasis Promise (bukan `setTimeout`) untuk menghindari isu *user-gesture context* & INP freeze pada klik tombol.

## 8.4 Koreksi Penempatan Mode (Bug Pra-Existing, Sudah Diperbaiki)

Sebelum 1 Agustus 2026, SPV Drop Point salah ditempatkan di mode Refine Total (`isCabang` juga `true` untuk SPV Drop Point) — mode itu memanggil endpoint `/api/drop-points` yang dibatasi ke `FULL_ACCESS_ROLES`, sehingga SPV Drop Point **selalu gagal (FORBIDDEN)** di fitur ini sejak awal, terlepas dari perubahan Role & Akses apa pun. Diperbaiki dengan menyempitkan `isCabang` ke `isFullAccess` saja — SPV Drop Point kini bergabung ke mode per-Sprinter bersama Admin DP.

------------------------------------------------------------------------

# 9. Fitur Pelengkap

## 9.1 Link Berbagi Laporan

-   Cakupan: **Dashboard** (agregat "Semua DP", tanpa auth) + **Data Long Tail** publik, read-only.
-   Token (`public_share_links.token`) **permanen** — tidak ada kolom kedaluwarsa.
-   Bisa **di-revoke lalu dibuat baru** (urutan wajib: revoke dulu, baru buat token baru).
-   Rate limiting **per token & per halaman** (dashboard vs data-longtail dihitung terpisah), dicatat di `public_share_access_log` termasuk percobaan yang ditolak (invalid token/rate-limited).

## 9.2 Pivot AWB per Sprinter

Di halaman Data Long Tail (`/feedback?view=data`), tombol "Pivot AWB per Sprinter" merekap jumlah waybill dikelompokkan DP Sampai → Sprinter Delivery, mengikuti filter yang sedang aktif di tabel. Grup tanpa Sprinter selalu ditaruh paling atas (meniru perilaku Excel Pivot Table). Bisa disalin sebagai gambar (chat) atau tabel (Excel), memakai pola copy yang sama dengan Monitoring Delivery.

## 9.3 Rebranding

Logo & tema J&T Express — `logo-horizontal.png` (sidebar expanded, tab publik) dan `logo-icon-master.png` (sidebar collapsed, favicon) menggantikan branding generik sebelumnya.

------------------------------------------------------------------------

# 10. Keamanan

-   **Password**: hash `scrypt` (`"salt:hash"`), tidak pernah plaintext maupun terkirim ke client (`Password Hash` selalu di-strip dari response listing user).
-   **Rate limiting login**: berbasis DB (`login_attempts`), 5 percobaan gagal/15 menit per NIK, konsisten lintas instance serverless (bukan in-memory yang bisa reset saat cold start).
-   **Otorisasi API**: setiap panggilan me-resolve ulang role/DP milik actor dari tabel `users` di server pada setiap request — tidak pernah mempercayai klaim sisi client.
-   **Optimistic locking**: kolom `longtail.version` (naik tiap update) mencegah dua admin menimpa perubahan satu sama lain secara diam-diam saat edit feedback bersamaan.
-   **Defense-in-depth Role & Akses**: menu yang dinonaktifkan diblokir di **dua lapis** — sidebar menyembunyikan link (Bagian 5.4) **dan** endpoint/halaman menolak akses langsung via URL (`requirePermission()`/`getMyMenuAccess()` di server), untuk 6 menu_key yang sudah ter-wire (Bagian 5.3).
-   **RLS OFF secara sengaja** (Bagian 2.1) — kontrol akses murni di API layer via `service_role` key; ini keputusan terdokumentasi, bukan kelalaian, dengan opsi diaktifkan sebagai peningkatan di masa depan.

------------------------------------------------------------------------

# 11. Utang Teknis & Rencana Lanjutan

Dicatat sebagai "Diketahui, Direncanakan" — bukan kegagalan, tapi pekerjaan yang sengaja ditunda demi prioritas lain:

1.  **9 menu_key Role & Akses belum ter-wire ke enforcement nyata**: `data_longtail`, `import_longtail`, `master_cabang`, `master_drop_point`, `master_feedback`, `user_management`, `riwayat_import`, `pengaturan`, `role_akses` (lihat Bagian 5.3). Toggle di UI untuk kunci-kunci ini saat ini murni kosmetik — tidak memblokir apa pun di backend maupun sidebar.
2.  **Gap sinkronisasi sidebar untuk 3 role full-access yang baru masuk matrix** (`app/(app)/layout.tsx`, baris yang menghitung `menuAccess` untuk komponen Sidebar): kondisinya masih `role === 'SPV Drop Point' || role === 'Admin DP'`, belum disinkronkan ke matrix 5-role penuh yang berlaku sejak bypass `hasPermission()` dihapus (Bagian 5.1). **Dampak:** terbatas ke 1 dari 15 menu_key — bila Super Admin menonaktifkan `monitoring_delivery_cabang` untuk seorang Admin Cabang/Manager Kota/Asisten Manager Kota, link "Monitoring Delivery" di sidebar akun itu **tidak ikut hilang** (meski isinya tetap benar diblokir oleh page-level gate). 14 menu_key full-access lain tidak terpengaruh karena tidak pernah diberi `menuKey` di `lib/nav.ts` untuk kelompok role ini. **Rekomendasi:** digabung menjadi satu task fokus bersama poin 1 (bukan ditambal satu-satu) — saat 9 menu_key lain diwujudkan, sekalian audit ulang & sinkronkan seluruh titik yang membaca `menuAccess`/`isGatedRole` supaya konsisten dengan matrix 5-role penuh.
3.  **Redesain `fetchScoped()`** (`lib/data/supabase/dashboard.ts`) dari fetch-semua-baris-lalu-agregasi-di-Node menjadi agregasi SQL native + RPC transaction — untuk skalabilitas jangka panjang saat volume `longtail` bertambah besar.
4.  **Form SPV Drop Point belum ada field pilih DP langsung** saat pembuatan akun — penugasan DP yang disupervisi masih lewat jalur terpisah.
5.  **Kolom "Perlu Review" (`longtail.perlu_review`) adalah dead UI** — flag ini tidak lagi dipakai sejak aturan dedup Clear TTD diganti jadi koreksi otomatis (Bagian 6.4), tapi kolomnya belum dibersihkan dari skema/UI.

------------------------------------------------------------------------

# 12. Lampiran: Changelog v1.0 → v2.0

*Ringkas per keputusan besar; changelog rinci v1.0 → v1.3 tetap ada di `PRD-LongTail-Dashboard-v1_2.md` Lampiran A dan tidak diulang di sini.*

| No | Perubahan | Tanggal / Commit | Alasan |
|---|---|---|---|
| 1 | Dashboard "keadaan tanggal X" via snapshot harian | 26 Jul 2026, `54719e8` | Perlu lihat kondisi Dashboard di tanggal tertentu tanpa menyimpan histori penuh tiap baris |
| 2 | **Cutover penuh ke Supabase PostgreSQL** — decommission Google Apps Script & Google Sheets sebagai backend aktif | 26 Jul 2026, `79de30b` | Google Sheets tidak lagi memadai untuk volume & concurrency yang dibutuhkan (Bagian 2.2) |
| 3 | Fitur Monitoring Delivery (mode Admin Cabang: per Drop Point; mode Admin DP: per Sprinter) | 29 Jul 2026, `5f9655a` dst. | Kebutuhan operasional baru di luar cakupan PRD v1.x, mengolah data JMS terpisah dari `longtail` |
| 4 | Fitur Link Berbagi Laporan (Dashboard + Data Long Tail publik, token permanen) | 30 Jul 2026, `cb6aa91` dst. | Kebutuhan berbagi laporan ke pihak tanpa akun sistem |
| 5 | Fitur Pivot AWB per Sprinter di Data Long Tail | 30 Jul 2026, `2270b8d` | Rekap volume per kurir tanpa export manual ke Excel Pivot Table |
| 6 | Monitoring Delivery Admin Cabang diganti flow "Rekap Lengkap" (Refine Total) | 31 Jul 2026, `4bcbc9c` | Penyesuaian kebutuhan operasional lapangan |
| 7 | **Migrasi autentikasi NIK+Password** (skema, Credentials provider, UI login dual-mode, lalu Google dinonaktifkan) | 31 Jul 2026, `d794fe4` → `f9142df` | Standarisasi identitas login internal, lepas dari ketergantungan akun Google individual |
| 8 | Akun General per Drop Point (`tipe_akun`) | 31 Jul 2026, seiring migrasi NIK | Mendukung DP yang memakai satu akun bersama, bukan akun per-orang |
| 9 | Struktur Cabang (Kota) + restrukturisasi sidebar Drop Point sebagai submenu | 1 Agu 2026, `9749d81` | Kebutuhan hierarki organisasi di atas Drop Point |
| 10 | Tabel `jabatan` (normalisasi role/label) + `users.jabatan_id` | 1 Agu 2026, `901ea55` | Dropdown Jabatan di form user, lepas dari hardcode 2 nilai role |
| 11 | **Perluasan hierarki role dari 2 ke 6 level**: Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota, SPV Drop Point, Admin DP | 1 Agu 2026, `6334aae` | Struktur organisasi nyata lebih kompleks dari Admin Cabang/Admin DP saja |
| 12 | Perbaikan bug: sidebar tidak menyembunyikan menu yang dimatikan Role & Akses (hanya isinya diblokir) | 1 Agu 2026, `de926f7` | Menu yang tampil tapi selalu error membingungkan user |
| 13 | **Perluasan Role & Akses**: matrix `role_permissions`/`user_permissions` dari 2 role (SPV Drop Point/Admin DP, 5 menu_key) menjadi 5 role (+Admin Cabang/Manager Kota/Asisten Manager Kota, 15 menu_key) yang bisa diatur Super Admin; UI Grid Jabatan kondisional 5 kartu (Super Admin) vs 2 kartu (role full-access lain) | 1 Agu 2026, `a52609b` → `aabefb4` | Super Admin butuh kontrol granular atas seluruh role, bukan hanya SPV Drop Point/Admin DP |
| 14 | Wiring menu_key `monitoring_delivery_dp`/`monitoring_delivery_cabang` ke Role & Akses; koreksi bug pra-existing SPV Drop Point salah ditempatkan di mode Refine Total (selalu FORBIDDEN, lihat Bagian 8.4) | 1 Agu 2026, `cb52dd8` → `6e31e8c` | Monitoring Delivery perlu ikut digating seperti menu lain, sekalian ditemukan bug penempatan mode |
| 15 | **Penghapusan bypass `hasPermission()` untuk Admin Cabang/Manager Kota/Asisten Manager Kota** — ketiganya kini benar-benar dicek matrix, bukan otomatis lolos semua menu | 1 Agu 2026, `b3fafb2` | Menuntaskan Role & Akses sebagai kontrol nyata untuk seluruh 5 role yang bisa diatur, bukan hanya SPV Drop Point/Admin DP |
| 16 | PRD ditulis ulang total (v2.0) berbasis audit kode & database, bukan rencana/diskusi | 1 Agu 2026 | PRD v1.2 sudah sangat tertinggal setelah rangkaian perubahan di atas berjalan lewat sesi berturut-turut tanpa tercatat balik ke dokumen resmi |
