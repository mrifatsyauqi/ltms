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
drop table if exists dashboard_snapshot cascade;
drop table if exists favorite_feedback cascade;
drop table if exists activity_log      cascade;
drop table if exists longtail_archive  cascade;
drop table if exists longtail          cascade;
drop table if exists import_batch      cascade;
drop table if exists import_mapping    cascade;
drop table if exists master_feedback   cascade;
drop table if exists master_drop_point cascade;
drop table if exists login_attempts    cascade;
drop table if exists users             cascade;
drop function if exists set_updated_at cascade;

-- Trigger util: auto-set updated_at.
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- USERS (store login; NextAuth resolve role + drop_point dari sini)
--
-- Migrasi auth NIK+password (dual-mode): `email` DIPERTAHANKAN sebagai PK &
-- login Google selama transisi; `nik` UNIQUE = identifier login baru
-- (Credentials). Untuk setup produksi yang sudah live, pakai file additive
-- supabase/auth_nik_migration.sql (bukan schema.sql yang destruktif).
-- ---------------------------------------------------------------------------
create table users (
  email         text primary key,
  nik           text,                       -- identifier login baru; nullable selama migrasi
  nama          text not null,
  nama_tampilan text,                        -- yg ditulis ke Activity_Log; general = "DP <KODE_DP>"
  tipe_akun     text not null default 'individual'
                check (tipe_akun in ('individual', 'general')),
  role          text not null check (role in ('Admin Cabang', 'Admin DP')),
  drop_point    text,                       -- kode DP; kosong utk Admin Cabang
  password_hash text,                       -- scrypt "salt:hash"; kosong = hanya Google
  status_aktif  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index users_nik_unique_idx on users (nik) where nik is not null;
create trigger users_updated before update on users
  for each row execute function set_updated_at();

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
-- MASTER DROP POINT
-- ---------------------------------------------------------------------------
create table master_drop_point (
  kode_dp      text primary key,
  nama_dp      text not null,
  wilayah      text,
  status_aktif boolean not null default true
);

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
