# Changelog

All notable changes to this project will be documented in this file.

---

## [v2.6.1] - 2026-08-06 (Communication Center: Critical Send Fixes, Feature Simplification & Card Redesign)

### Fixed
- **Bug: Simpan Template Gagal**:
  - **Penyebab**: Phase v2.6.0 menghentikan penulisan `json_template` saat create/update, tapi kolom `card_templates.json_template` di database masih `NOT NULL` tanpa default sampai migration `communication_center_render_pipeline_migration.sql` benar-benar dijalankan — INSERT gagal dengan pelanggaran constraint dan hanya tampil sebagai error generik `INTERNAL_ERROR` ke pengguna.
  - **Status**: Migration sudah dikonfirmasi dijalankan pengguna di Supabase.
- **Bug: Send Test / Kirim ke Feishu → `400 Bad Request`**:
  - **Penyebab #1 (root cause utama, dikonfirmasi via `scripts/audit-send-test-card.ts` yang membandingkan compile output persis dengan payload Send Test)**: Ketiga starter preset menyetel `actionButton.url: '{{dashboard_url}}'`, tapi `normalizeContext()` tidak pernah mengisi variabel `dashboard_url` — `MessageTemplateEngine.render()` sengaja membiarkan placeholder tak ter-resolve apa adanya, sehingga string literal `{{dashboard_url}}` (bukan URL) terkirim sebagai `url` tombol aksi ke Feishu API, yang menolaknya. Bug pre-existing (bukan regresi dari refactor v2.6.0), belum pernah ketahuan karena jalur ini belum pernah diuji end-to-end ke Feishu asli sebelumnya.
  - **Perbaikan (`card-compiler.service.ts`)**: URL tombol aksi divalidasi harus berformat `http(s)://` sebelum dipakai; kalau hasil render masih placeholder tak ter-resolve, otomatis fallback ke `appBaseUrl`.
  - **Penyebab #2 (ditemukan setelah Penyebab #1 diperbaiki, dari error Feishu yang lebih detail)**: `[Code 230099] there is an invalid user resource (at/person) in your card; ErrorValue: ou_demo_limpung_01` — 8 baris data seed awal di `communication_mention_mappings` (`supabase/communication_mentions_migration.sql`) memakai `feishu_open_id` palsu (`ou_demo_*`) yang tidak pernah terdaftar di tenant Feishu asli. Setiap kartu yang menyebut kecamatan/kurir/DP tsb selalu gagal kirim karena Feishu memvalidasi tag `<at id="...">` terhadap direktori user asli.
  - **Mitigasi sementara (atas keputusan pengguna)**: `supabase/clear_demo_mention_open_ids.sql` — mengosongkan `feishu_open_id` utk 8 baris seed demo (fallback otomatis ke teks `@Nama` biasa, tidak merusak kartu) sampai Open ID asli diisi.
  - **Diagnostic gap yang turut diperbaiki (`message.service.ts`)**: kode sebelumnya membuang body response Feishu saat gagal, hanya melempar status HTTP polos. Sekarang membaca `code`/`msg` asli dari Feishu di setiap error non-2xx — inilah yang memungkinkan Penyebab #2 ketahuan tanpa akses browser/Feishu langsung.
- **Bug pre-existing lain (ditemukan & diperbaiki saat verifikasi desain ulang kartu Delivery)**: `MessageTemplateEngine.normalizeContext()` (`message-template.engine.ts`) tidak pernah menghitung variabel `delivered` / `pending_delivery` / `delivery_sla` sama sekali (hanya `total_arrived` / `delivery_percentage`) — preset Monitoring Delivery yang LAMA sudah memakai placeholder ini sejak awal dan selalu gagal ter-resolve, tapi karena bukan URL, Feishu tidak menolaknya — cuma tampil sebagai teks mentah `{{delivered}}` dsb di kartu, kesalahan yang diam-diam lolos. Sekarang dihitung & dialiaskan dengan benar.

### Added
- **Fitur "Cari Open ID" (`mentions/lookup-open-id`)**: Open ID Feishu ternyata tidak pernah tampil di profil pengguna manapun (identitas teknis khusus per-app/bot, bukan personal) — panduan bawaan lama yang menyuruh cek profil diperbaiki. Fitur baru mencari Open ID resmi via Feishu Contact API (`contact/v3/users/batch_get_id`) berdasarkan nomor HP (dengan normalisasi format lokal Indonesia → E.164):
  - `FeishuContactService.lookupOpenIdByMobile()` (`services/communication/providers/feishu/contact.service.ts`).
  - `POST /api/communication/mentions/lookup-open-id`.
  - Kolom Nomor HP (sebelumnya ada di database tapi tak pernah ditampilkan di form) + tombol "Cari Open ID" di halaman Mention Mapping, otomatis mengisi field Open ID saat ketemu.
- **`subdistricts.listStyle` opsi baru di compiler (`'divided'` default | `'numbered'`)**: render list Drop Point Tujuan sebagai `1. Nama (jumlah)` dengan mention di baris baru terindentasi, tanpa mengubah tampilan template lain yang masih pakai gaya lama.
- **Toggle Builder yang sebelumnya tidak ada meski compiler sudah mendukung**: show/hide independen utk 3 kolom info header (Pickup DP / Target Kota / Update), show/hide seluruh section Penugasan Operasional, enable/disable tombol aksi (sebelumnya selalu terpaksa aktif begitu label disentuh).

### Removed
- **Fitur Version History / Rollback**: dihapus total (2 endpoint API, tombol & modal Riwayat Versi, method service `getVersions`/`rollbackToVersion`) — dianggap tidak diperlukan, template cukup diedit langsung. Tulisan riwayat versi ke `card_template_versions` tetap jalan di background sebagai audit trail.
- **Fitur Archive → diganti Hapus Permanen**: Archive sebelumnya bekerja tapi tidak ada UI untuk melihat/memulihkan item yang diarsipkan (item "hilang" tanpa cara balik). Diganti tombol Hapus (dengan dialog konfirmasi eksplisit) yang benar-benar menghapus baris `card_templates` — diverifikasi dulu di skema bahwa `communication_logs` tidak punya foreign key ke `card_templates` sama sekali (menyimpan `card_json` snapshot sendiri sejak v2.6.0), jadi History tidak terpengaruh oleh penghapusan template.

### Changed & Refactored
- **Desain ulang preset "Monitoring INC" & "Monitoring Delivery"** (`template-presets.ts`) sesuai spesifikasi layout baru — diaudit dulu terhadap skema block yang ada (tidak perlu tipe block baru), lalu dibangun lewat mekanisme "Gunakan Preset" Builder (bukan hardcode JSON):
  - Monitoring INC: header 2-kolom (DP Pickup | Waktu Generate), grid KPI 2×2 dengan ikon, list Drop Point Tujuan bernomor dgn mention per-baris, tanpa tombol aksi.
  - Monitoring Delivery: header 1-kolom (Waktu Update saja), grid KPI 2×2, tanpa list penugasan/tombol aksi.
  - **Catatan**: template yang sudah ada di production (dibuat dari preset lama) tidak otomatis berubah — perlu dihapus & dibuat ulang dari preset, atau diedit manual lewat toggle Builder yang baru.

---

## [v2.6.0] - 2026-08-05 (Communication Center: Single Render Pipeline & API Consistency)

### Added
- **`CardRenderPipeline` (`services/communication/configuration/card-render-pipeline.service.ts`)**: satu pipeline server-side yang resolve `blocksConfig` + mention mapping lalu panggil `CardCompilerService.compileCard()` — dipakai identik oleh endpoint preview dan jalur kirim asli, sehingga Preview dan Send tidak mungkin lagi berbeda hasil.
- **`POST /api/communication/card-templates/preview`**: satu-satunya cara browser mendapat JSON kartu terkompilasi — browser tidak pernah lagi generate JSON Feishu sendiri.
- **`<InteractiveCardPreview>` (`components/communication/interactive-card-preview.tsx`)**: satu komponen preview yang menerima JSON terkompilasi (bukan `blocks_config`), dipakai identik di Card Builder Preview, Share Dialog Preview, dan History Preview.
- **`communication_logs.card_json`** (migration `communication_center_render_pipeline_migration.sql`): snapshot JSON kartu yang benar-benar terkirim, dipakai History Preview merender kartu yang sama persis tanpa perlu template masih ada.
- **Route tree baru `/api/communication/card-templates/**`**, termasuk endpoint rollback versi yang sebelumnya dipanggil client tapi tidak pernah ada.
- **Konversi TanStack Query** di 5 client surface Communication Center (Card Templates, Groups, Mentions, Share Dialog, History Dialog) — save reaktif, tanpa refresh manual.
- **`commApi` (`lib/communication-client.ts`)**: helper fetch seragam yang menegakkan envelope `{ok, data, error}` di seluruh Communication Center.

### Changed & Refactored
- **`blocks_config` menjadi satu-satunya source of truth** — `json_template` tidak lagi ditulis saat create/update template (kolom dipertahankan, dibuat nullable via migration, non-destruktif).
- **Envelope API distandardisasi** ke `{ok, data, error}` di seluruh route Communication Center (sebelumnya `mentions/*` memakai `{success,...}` yang berbeda sendiri).
- **Rekonsiliasi dengan commit paralel `2aaa13f`** (implementasi unified-API-client independen yang tumpang tindih, dibuat bersamaan tanpa sepengetahuan sesi ini): di-rebase, arsitektur render pipeline sesi ini dipertahankan pada bagian yang tumpang tindih; komponen unik `2aaa13f` (`api-client.ts`, `dto.ts`, route `templates/card/*` versi baru) dihapus karena terduplikasi sepenuhnya oleh implementasi ini.

### Removed
- **Fitur Message Template legacy** (CRUD teks bebas lama): service, 6 route API, dan halaman frontend dihapus total. `MessageTemplateEngine` (mesin interpolasi `{{variable}}` yang dipakai di dalam compiler) sengaja dipertahankan — bukan bagian dari legacy yang dihapus.
- **Dead code**: `card.builder.ts`, `card.service.ts` (fluent builder & service lama, sudah tidak dipanggil di manapun selain test), alias `CardCompilerService.compile()`.
- **Renderer client-side duplikat** (`feishu-card-preview.tsx`) — digantikan `<InteractiveCardPreview>` yang menerima JSON server, bukan `blocks_config` mentah.
- **Route duplikat/mati**: `/api/communication/feishu/groups*`, `/api/communication/groups/sync`.

### Fixed
- **Envelope mismatch** di seluruh route `mentions/*` (`{success,...}` → `{ok,...}`), menyebabkan dropdown grup/mention berpotensi selalu kosong di production.
- **`handleArchive` no-op**: tombol arsip sebelumnya mengirim PUT dengan body yang diabaikan service, tidak benar-benar mengubah status apapun.
- **Endpoint rollback yang tidak pernah ada**: client selalu memanggil endpoint yang belum pernah dibuat sebelumnya.

### Verified
- `tsc --noEmit`, seluruh unit test, dan `npm run build` dijalankan bersih di setiap checkpoint perubahan.

---

## [v2.5.1] - 2026-08-05 (Phase 2.5.1: Communication Center Access Revision & Global Scope Authorization)

### Added
- **Reusable Communication Authorization & Data Scope Layer (`web/src/services/communication/utils/authorization.ts`)**:
  - Implementasi class `CommunicationAuthorizationService` dengan metode `resolveUserScope` dan `validateDataScope`.
  - Memetakan wewenang dan cakupan data pengguna secara terisolasi dan dinamis dari database Supabase (`cabang`, `master_drop_point`, relasi `spv_drop_point_user_id`):
    - **Super Admin**: Akses global tanpa batas ke seluruh kota dan drop point.
    - **Admin Cabang**: Akses penuh ke seluruh kota dan drop point dalam lingkup cabang.
    - **Manager Kota / Asisten Manager Kota**: Terikat pada kota tanggung jawabnya (`allowedKota`) beserta drop point di bawahnya.
    - **SPV Drop Point**: Terikat pada seluruh Drop Point yang disupervisi (`allowedDropPoints`).
    - **Admin Drop Point**: Terikat khusus pada Drop Point miliknya sendiri.
  - Memvalidasi parameter `targetScope`, `targetKota`, `targetDp`, dan metrik laporan di Backend sebelum pengiriman dieksekusi untuk mencegah kebocoran data (*data leakage*) lintas wilayah.

- **Global Multi-Module Communication Contracts & Card Builders (`communication.types.ts` & `card.builder.ts`)**:
  - Membuka Communication Center sebagai layanan global untuk seluruh modul LTMS:
    - `monitoring_inc` (Monitoring Incoming SLA)
    - `monitoring_delivery` (Monitoring Delivery JMS & Sprinter)
    - `longtail` (Laporan Paket Status Long Tail)
    - `dashboard` (Ringkasan KPI Dashboard Operasional)
    - `custom` / `analytics` (Laporan Custom & Analitik)
  - Penambahan builder method fleksibel pada `FeishuCardBuilder`:
    - `createDeliveryCard`, `createDashboardCard`, `createLongtailCard`, `createGenericReportCard`.
  - Dispatching otomatis pada `FeishuCardService.generateCard(data, imageKey)` berdasarkan metadata `module` pemanggil.

- **Global Reusable Frontend Share Dialog (`web/src/components/communication/feishu-share-dialog.tsx`)**:
  - Komponen modal universal yang siap digunakan oleh modul apa pun di LTMS dengan dukungan dynamic module header, scope badge, live preview card, preview gambar HD, dan preview caption.
  - `web/src/components/monitoring-inc/feishu-share-dialog.tsx` dialihkan me-re-export modul global untuk arsitektur DRY yang bersih.

- **Automated Scope Authorization Test Suite (`web/src/services/communication/authorization.test.ts`)**:
  - 13 unit test baru yang mencakup pengujian isolasi scope untuk seluruh role (Super Admin, Admin Cabang, Manager Kota, SPV DP, Admin DP), penolakan pengiriman data lintas cabang/kota/DP, serta pembentukan card dinamis lintas modul.

### Changed & Refactored
- **Refactoring Endpoint Pengiriman (`POST /api/communication/send`)**:
  - Menghapus pengecekan role manual (hardcoded) dan menyerahkan sepenuhnya ke layer otorisasi backend `communicationAuthService.authorizeSend`.
  - Mengembalikan status `403 FORBIDDEN` dengan deskripsi penyebab penolakan yang jelas saat terjadi pelanggaran data scope.

---

## [v2.5.0] - 2026-08-05 (Phase 2.5: Feishu Open Platform Production E2E Verification & Hardening)

### Added
- **Automated E2E Production Test Suite (`npm run test:feishu`)**:
  - Script test runner mandiri (`web/scripts/test-feishu-e2e.mjs`) untuk validasi *end-to-end* seluruh alur Feishu Open Platform secara berkala:
    1. Autentikasi dan penerbitan *Tenant Access Token* (`/auth/v3/tenant_access_token/internal`).
    2. Query dan penemuan grup bot Feishu (`/im/v1/chats`).
    3. Unggah gambar laporan visual HD ke penyimpanan Feishu Cloud (`/im/v1/images`).
    4. Pembuatan dan pengiriman *Feishu Interactive Card 2.0* (`/im/v1/messages`).
    5. Validasi konektivitas tabel audit Supabase (`feishu_groups` dan `communication_logs`).
  - Dilengkapi pengukuran latensi respons per tahap (ms) dan pelaporan matriks diagnostik terperinci.

### Changed & Hardened
- **Role Permission Guard & Normalisasi Akses (`/api/communication/send`)**:
  - Memperluas izin pengiriman laporan Monitoring INC ke seluruh role pengguna operasional aktif (`Super Admin`, `Admin Cabang`, `Manager Kota`, `Asisten Manager Kota`, `SPV Drop Point`, `Admin DP`).
  - Menerapkan pencocokan *case-insensitive* pada string role session untuk mencegah kesalahan otorisasi `FORBIDDEN` tak terduga.
- **Penyempurnaan Pesan Diagnostik Lingkungan Produksi**:
  - Pesan error kredensial diperjelas untuk memandu konfigurasi pada *Vercel Dashboard Environment Variables* maupun file `.env.local`.
- **Database Schema Cache Refresh (`feishu_communication_center.sql`)**:
  - Menambahkan perintah `NOTIFY pgrst, 'reload schema';` pada script migrasi Supabase untuk sinkronisasi instan PostgREST cache.

### Verified
- **Validasi Produksi Nyata (Live Vercel Deployment)**:
  - Sukses mengirimkan pesan *Feishu Interactive Card Monitoring INC* beresolusi tinggi langsung ke group chat resmi Feishu (*Uji Coba LTMS*) dari web aplikasi production Vercel.

---

## [v2.4.0] - 2026-08-04 (Phase 2: Feishu Open Platform Production Integration & Enterprise Architecture)

### Added
- **Feishu Open Platform Official Integration (`web/src/services/communication`)**:
  - **Dynamic Base URL**: Penggunaan `FEISHU_API_BASE_URL` (default: `https://open.feishu.cn/open-apis`) tanpa hardcoded string.
  - **Health Check Endpoint (`GET /api/communication/health`)**: Diagnostik real-time untuk status konektivitas Feishu API, token, bot, chat API, image API, dan message API.
  - **Type-Safe `FeishuCardBuilder` (`card.builder.ts`)**: Fluent builder OOP untuk memvalidasi struktur Interactive Card JSON 2.0 Feishu.
  - **Strict Response Validation dengan Zod (`communication.schemas.ts`)**: Validasi seluruh respons Feishu API (Token, Chats, Upload Image, Upload File, Send Message) mencegah runtime schema mismatch.
  - **Sliding-Window Rate Limiter (`utils/rate-limiter.ts`)**: Pembatasan 5 request per 10 detik per user untuk proteksi anti-spam.
  - **Promise Concurrency Queue (`utils/queue.ts`)**: Antrean pengiriman FIFO untuk mencegah race condition atau double submission.
  - **API Request Timeout 15 Detik (`utils/fetch-timeout.ts`)**: `AbortController` terintegrasi pada seluruh outbound fetch request Feishu.
  - **Enhanced Audit Logger (`utils/logger.ts`)**: Pencatatan metadata mendalam (`endpoint`, `statusCode`, `responseTimeMs`, `retryCount`, `requestId`, `messageId`).
  - **Permission Role Guard**: Validasi role wewenang (Super Admin, Admin Cabang, Manager Kota, Asisten Manager Kota) pada endpoint `/api/communication/send`.

- **Frontend Enterprise UI/UX Improvements (`/monitoring-inc`)**:
  - **3-Tab Live Preview**: Preview Mockup Card, Preview Gambar HD 1200×900, dan Preview Caption sebelum pengiriman.
  - **Group Sync Status**: Penunjuk waktu *Terakhir Sinkron: HH:mm WIB* dengan tombol *Sinkronkan Ulang*.
  - **Dedicated Riwayat Pengiriman (`feishu-history-dialog.tsx`)**: Modal audit log interaktif lengkap dengan status badge, response latency ms, grup tujuan, target kota, dan email pengirim.

---

## [v2.3.0] - 2026-08-04 (Communication Center: Feishu Open Platform Integration v1.0)

### Added
- **Communication Center Architecture (`web/src/services/communication`)**:
  - **Modular Core Contracts**: Interface `ICommunicationProvider`, `ICommunicationService`, dan type definition untuk pengiriman pesan lintas channel.
  - **Feishu Open Platform Provider (`providers/feishu/`)**:
    - `FeishuAuthService`: Pengelolaan siklus Tenant Access Token otomatis (`tenant_access_token`) dengan caching in-memory berbasis TTL dan auto-refresh.
    - `FeishuChatService`: Sinkronisasi dan caching daftar Group Feishu (`/im/v1/chats`) yang diikuti bot ke database Supabase (`feishu_groups`).
    - `FeishuImageService`: Pengunggahan gambar report hasil render ke Feishu Open Platform (`/im/v1/images`) dengan return `image_key`.
    - `FeishuFileService`: Pengunggahan file lampiran (`/im/v1/files`) dengan return `file_key`.
    - `FeishuCardService`: Generator JSON Feishu Interactive Card 2.0 untuk Monitoring INC (header banner merah, metrik KPI, distribusi kecamatan, lampiran gambar HD).
    - `FeishuMessageService`: Pengiriman pesan & Interactive Card ke Group Feishu (`/im/v1/messages?receive_id_type=chat_id`).
  - **Resilience & Audit Layer**:
    - `MemoryCache`: In-memory key-value cache dengan TTL expiry untuk token.
    - `withRetry`: 3x exponential backoff retry mechanism (500ms, 1000ms, 2000ms) untuk mengantisipasi transient network failure.
    - `CommunicationLogger`: Audit logging komprehensif ke tabel Supabase `communication_logs` (channel, chat_id, message_type, status, response_time_ms, error).

- **Backend API Endpoints (`web/src/app/api/communication/`)**:
  - `GET /api/communication/feishu/groups`: Mengambil daftar Group Feishu dari cache database.
  - `POST /api/communication/feishu/groups/sync`: Menyinkronkan daftar Group langsung dari Feishu API.
  - `POST /api/communication/send`: Endpoint utama pengiriman pesan/Interactive Card ke channel tujuan (terlindungi session NextAuth).
  - `GET /api/communication/logs`: Endpoint riwayat audit log komunikasi.

- **Frontend User Interface & Integration (`/monitoring-inc`)**:
  - **Tombol "Bagikan" (`Share2`)**: Terintegrasi pada action toolbar Monitoring INC.
  - **Feishu Share Dialog (`feishu-share-dialog.tsx`)**:
    - Modal interaktif dengan pencarian group real-time dan tombol sinkronisasi (`RefreshCw`).
    - Multi-stage loading progress bar (*Preparing Data* → *Rendering Report* → *Generating Caption* → *Uploading Image* → *Sending Interactive Card* → *Completed*).
    - Auto-dismiss modal dan notifikasi toast hijau saat pengiriman berhasil.

- **Database Migration (`supabase/feishu_communication_center.sql`)**:
  - Tabel `feishu_groups`: Chat ID, nama group, member count, avatar, last sync timestamp.
  - Tabel `communication_logs`: Log pengiriman pesan, status, response time, error message, dan JSON payload summary.

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
