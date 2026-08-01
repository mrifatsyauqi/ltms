-- ============================================================================
-- LTMS — Skema Supabase (Postgres). Migrasi dari Google Sheets/Apps Script.
--
-- Cara pakai:
--   Supabase Dashboard -> SQL Editor -> New query -> tempel seluruh file ini
--   -> Run. Aman dijalankan ulang (idempotent: DROP ... IF EXISTS di atas).
--
-- Catatan desain vs sheet lama:
--   - 'Status Aktif'/'Perlu Review' (teks 'Aktif'/'Ya') -> boolean.
--   - 'Umur Paket' (sel dwifungsi) -> `umur_frozen` (null = hitung live dari
--     waktu_sampai; berisi angka HANYA saat Clear TTD = umur dibekukan).
--   - Optimistic lock: kolom `version bigint` (naik tiap update) menggantikan
--     hash isi Feedback+Log. Frontend `__version` dipetakan ke kolom ini.
--   - 'Tanggal'+'Jam' terpisah -> satu `created_at timestamptz`.
--   - waktu_sampai tetap TEXT (simpan apa adanya dari Excel, mis.
--     "2026-07-04 18:34:49") supaya jam tidak bergeser timezone.
--   - Lapisan lib/db di Next.js memetakan kolom snake_case <-> bentuk respons
--     lama (mis. 'No. Waybill') sehingga API & frontend TIDAK berubah.
-- ============================================================================

-- Bersihkan (urut mundur dependensi) supaya bisa dijalankan ulang saat dev.
drop table if exists user_permissions   cascade;
drop table if exists role_permissions   cascade;
drop table if exists dashboard_snapshot cascade;
drop table if exists favorite_feedback cascade;
drop table if exists activity_log      cascade;
drop table if exists longtail_archive  cascade;
drop table if exists longtail          cascade;
drop table if exists import_batch      cascade;
drop table if exists import_mapping    cascade;
drop table if exists master_feedback   cascade;
drop table if exists master_drop_point cascade;
drop table if exists cabang            cascade;
drop table if exists login_attempts    cascade;
drop table if exists users             cascade;
drop table if exists jabatan           cascade;
drop function if exists set_updated_at cascade;

-- Trigger util: auto-set updated_at.
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- JABATAN — normalisasi role/label organisasi jadi entitas resmi dgn id,
-- LEPAS dari kolom users.role (text) yang TETAP DIPERTAHANKAN sbg
-- fallback/cross-check selama masa transisi (lihat supabase/jabatan_migration.sql,
-- jabatan_backfill.sql, jabatan_not_null.sql utk setup produksi yang sudah
-- live - 3 file terpisah krn tiap tahap butuh konfirmasi sebelum lanjut).
-- Dev-recreate (file ini) langsung seed 6 baris supaya jabatan_id bisa
-- NOT NULL sejak awal tanpa perlu backfill (tak ada data lama di setup baru).
-- ---------------------------------------------------------------------------
create table jabatan (
  id        uuid primary key default gen_random_uuid(),
  nama      text not null unique,
  tingkat   integer not null,
  deskripsi text
);
insert into jabatan (nama, tingkat, deskripsi) values
  ('Super Admin',           1, null),
  ('Admin Cabang',          2, null),
  ('Manager Kota',          3, null),
  ('Asisten Manager Kota',  4, null),
  ('SPV Drop Point',        5, null),
  ('Admin DP',              6, null);

-- ---------------------------------------------------------------------------
-- USERS (store login; NextAuth resolve role + drop_point dari sini)
--
-- Migrasi auth NIK+password (dual-mode): `email` DIPERTAHANKAN sebagai PK &
-- login Google selama transisi; `nik` UNIQUE = identifier login baru
-- (Credentials). Untuk setup produksi yang sudah live, pakai file additive
-- supabase/auth_nik_migration.sql (bukan schema.sql yang destruktif).
-- ---------------------------------------------------------------------------
create table users (
  id            uuid not null default gen_random_uuid(), -- identitas stabil utk FK (Cabang/SPV dll),
                                                           -- LEPAS dari mekanisme login (email/NIK).
                                                           -- email TETAP primary key (lihat catatan di
                                                           -- atas + FK nyata di favorite_feedback).
  email         text primary key,
  nik           text,                       -- identifier login baru; nullable selama migrasi
  nama          text not null,
  nama_tampilan text,                        -- yg ditulis ke Activity_Log; general = "DP <KODE_DP>"
  tipe_akun     text not null default 'individual'
                check (tipe_akun in ('individual', 'general')),
  role          text not null check (role in (
                  'Super Admin', 'Admin Cabang', 'Manager Kota',
                  'Asisten Manager Kota', 'SPV Drop Point', 'Admin DP'
                )),
  drop_point    text,                       -- kode DP; kosong utk Admin Cabang
  jabatan_id    uuid not null references jabatan(id) on delete set null, -- normalisasi role, lihat blok JABATAN di atas
  password_hash text,                       -- scrypt "salt:hash"; kosong = hanya Google
  status_aktif  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index users_id_unique_idx on users (id);
create index users_jabatan_id_idx on users (jabatan_id);
create unique index users_nik_unique_idx on users (nik) where nik is not null;
create trigger users_updated before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- ROLE_PERMISSIONS / USER_PERMISSIONS (Role & Akses) — matrix menu HANYA utk
-- 'SPV Drop Point' & 'Admin DP' (2 role "diatur"); Super Admin/Admin Cabang/
-- Manager Kota/Asisten Manager Kota TIDAK PERNAH masuk matrix ini - akses
-- mereka given/hardcoded dari Langkah 3 (hasFullAccess), tak berubah oleh
-- fitur ini sama sekali. menu_key dibatasi ke 4 menu yang memang dimiliki
-- SPV DP/Admin DP di sidebar (lihat lib/nav.ts) - Monitoring Delivery &
-- Profil SENGAJA tak masuk matrix (selalu accessible, tak pernah digating).
--
-- role_permissions = default per role; user_permissions = override per akun
-- individual (menimpa default HANYA utk akun itu). Resolusi (lib/data/
-- supabase/permissions.ts, hasPermission()): user_permissions dulu kalau
-- ada barisnya, baru fallback ke role_permissions.
-- ---------------------------------------------------------------------------
create table role_permissions (
  role       text not null check (role in ('SPV Drop Point', 'Admin DP')),
  menu_key   text not null check (menu_key in (
               'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit', 'riwayat_feedback'
             )),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (role, menu_key)
);
create trigger role_permissions_updated before update on role_permissions
  for each row execute function set_updated_at();

create table user_permissions (
  user_id    uuid not null references users(id) on delete cascade,
  menu_key   text not null check (menu_key in (
               'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit', 'riwayat_feedback'
             )),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, menu_key)
);
create trigger user_permissions_updated before update on user_permissions
  for each row execute function set_updated_at();

-- Seed default: SAMA PERSIS perilaku yang sudah ada dari Langkah 3 (semua
-- true) - matrix ini baru "berguna" kalau nanti ada yang sengaja dimatikan,
-- tidak ada perubahan visual/akses mendadak begitu fitur ini live.
insert into role_permissions (role, menu_key, enabled)
select r.role, k.menu_key, true
from (values ('SPV Drop Point'), ('Admin DP')) as r(role),
     (values ('dashboard'), ('feedback_longtail_view'), ('feedback_longtail_edit'), ('riwayat_feedback')) as k(menu_key);

-- ---------------------------------------------------------------------------
-- LOGIN_ATTEMPTS (rate limiting login per NIK — anti brute-force; berbasis DB
-- supaya konsisten lintas instance serverless). Max 5 gagal/15 menit -> kunci
-- sementara via `locked_until`; login sukses me-reset baris. Penegakan di API.
-- ---------------------------------------------------------------------------
create table login_attempts (
  nik          text primary key,
  failed_count int         not null default 0,
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- CABANG (Kota) — struktur organisasi di atas Drop Point. Manager Kota &
-- Asisten Manager adalah LABEL ORGANISASI (bukan role otorisasi baru) yang
-- menunjuk ke akun users existing manapun (role apapun, cukup status_aktif).
-- ---------------------------------------------------------------------------
create table cabang (
  kode_kota                text primary key,
  nama_kota                text not null,
  manager_kota_user_id     uuid references users(id) on delete set null,
  asisten_manager_user_id  uuid references users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create trigger cabang_updated before update on cabang
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- MASTER DROP POINT
--
-- kode_kota nullable: DP existing tetap tampil ("Belum ada Kota") sampai
-- di-assign manual. spv_drop_point_user_id = label organisasi (lihat cabang
-- di atas). Admin Drop Point TIDAK punya kolom sendiri di sini - REUSE
-- users.role='Admin DP' + users.drop_point=kode_dp yang sudah ada.
-- ---------------------------------------------------------------------------
create table master_drop_point (
  kode_dp                text primary key,
  nama_dp                text not null,
  wilayah                text,
  status_aktif           boolean not null default true,
  kode_kota              text references cabang(kode_kota) on delete set null,
  spv_drop_point_user_id  uuid references users(id) on delete set null
);
create index master_drop_point_kode_kota_idx on master_drop_point (kode_kota);

-- ---------------------------------------------------------------------------
-- MASTER FEEDBACK
-- ---------------------------------------------------------------------------
create table master_feedback (
  id           bigint generated always as identity primary key,
  nama_feedback text not null,
  status_aktif boolean not null default true
);
create index master_feedback_aktif_idx on master_feedback (status_aktif);

-- ---------------------------------------------------------------------------
-- FAVORITE FEEDBACK (per Admin DP; menentukan urutan combobox feedback)
-- ---------------------------------------------------------------------------
create table favorite_feedback (
  id             bigint generated always as identity primary key,
  email_admin_dp text not null references users(email) on delete cascade,
  nama_feedback  text not null,
  urutan         int  not null default 0,
  unique (email_admin_dp, nama_feedback)
);
create index favorite_feedback_email_idx on favorite_feedback (email_admin_dp);

-- ---------------------------------------------------------------------------
-- LONGTAIL (data paket utama)
-- ---------------------------------------------------------------------------
create table longtail (
  no_waybill        text primary key,
  status_terakhir   text,
  alasan_bermasalah text,
  dp_sampai         text,                    -- kode DP (soft ref ke master_drop_point)
  waktu_sampai      text,                    -- string apa adanya dari Excel
  umur_frozen       int,                     -- null = hitung live; angka = beku (Clear TTD)
  sprinter_delivery text,
  cod               text,
  delivery_attempt  int  not null default 0,
  feedback          text,
  log_feedback      text,                    -- riwayat multi-baris (dipisah newline)
  perlu_review      boolean not null default false,
  version           bigint  not null default 1,   -- optimistic lock
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index longtail_dp_idx    on longtail (dp_sampai);
create index longtail_feedback_idx on longtail (feedback);
create trigger longtail_updated before update on longtail
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- LONGTAIL ARCHIVE (Clear TTD > 30 hari dipindah ke sini)
-- ---------------------------------------------------------------------------
create table longtail_archive (
  no_waybill        text primary key,
  status_terakhir   text,
  alasan_bermasalah text,
  dp_sampai         text,
  waktu_sampai      text,
  umur_frozen       int,
  sprinter_delivery text,
  cod               text,
  delivery_attempt  int,
  feedback          text,
  log_feedback      text,
  tipe_close        text,                    -- 'Clear TTD' | 'Close Alur' (v1.3 auto-close)
  tanggal_arsip     date not null default current_date
);

-- ---------------------------------------------------------------------------
-- ACTIVITY LOG (jejak perubahan feedback/import)
-- ---------------------------------------------------------------------------
create table activity_log (
  id         bigint generated always as identity primary key,
  user_email text,
  dp         text,
  waybill    text,
  attempt_ke int,
  data_lama  text,
  data_baru  text,
  sumber     text,                           -- 'Manual Feedback' | 'Auto-update Import'
  created_at timestamptz not null default now()
);
create index activity_log_waybill_idx on activity_log (waybill);
create index activity_log_dp_idx      on activity_log (dp);
create index activity_log_created_idx on activity_log (created_at desc);

-- ---------------------------------------------------------------------------
-- IMPORT BATCH (riwayat import)
-- ---------------------------------------------------------------------------
create table import_batch (
  batch_id     text primary key,
  admin_cabang text,
  nama_file    text,
  total_baris  int,
  berhasil     int,
  gagal        int,
  status       text,
  keterangan   text,
  created_at   timestamptz not null default now()
);
create index import_batch_created_idx on import_batch (created_at desc);

-- ---------------------------------------------------------------------------
-- IMPORT MAPPING (template mapping header import)
-- ---------------------------------------------------------------------------
create table import_mapping (
  nama_template text primary key,
  mapping       jsonb not null,              -- {sourceHeader: targetField}
  dibuat_oleh   text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DASHBOARD SNAPSHOT (v1.3): agregat harian per scope utk "Dashboard keadaan
-- tanggal X". Diisi cron harian (~23:55 WIB). scope = 'ALL' atau kode DP.
-- `data` = payload DashboardData yang dibekukan hari itu.
-- ---------------------------------------------------------------------------
create table dashboard_snapshot (
  tanggal    date not null,
  scope      text not null,               -- 'ALL' | kode DP
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tanggal, scope)
);
create index dashboard_snapshot_tanggal_idx on dashboard_snapshot (tanggal desc);

-- ============================================================================
-- Catatan RLS: kontrol akses (Admin DP hanya DP-nya) ditegakkan di API layer
-- Next.js memakai service_role key (bypass RLS). RLS dibiarkan OFF dulu sesuai
-- keputusan migrasi; bisa diaktifkan sebagai peningkatan setelah stabil.
-- ============================================================================
