-- ============================================================================
-- LTMS — Migrasi Autentikasi: tambah NIK + Password + Akun General (Tahap 1).
--
-- File TERPISAH dari schema.sql SENGAJA: schema.sql men-DROP semua tabel di
-- bagian atas (aman utk setup awal/dev, KATASTROFIK di produksi yang sudah
-- live). File ini HANYA menambah kolom/tabel/index secara ADDITIVE & idempoten
-- (ALTER ... ADD COLUMN IF NOT EXISTS / CREATE ... IF NOT EXISTS) — aman
-- dijalankan berdiri sendiri terhadap database produksi tanpa merusak data.
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel file ini
-- -> Run. Aman dijalankan ulang.
--
-- KONTEKS MIGRASI BERTAHAP (dual-mode):
--   - Kolom `email` (Google) DIPERTAHANKAN sebagai PRIMARY KEY & tetap dipakai
--     login Google selama transisi. NIK ditambah sebagai UNIQUE (bukan PK) —
--     paling aman, tak menyentuh FK favorite_feedback.email_admin_dp.
--   - `nik` NULLABLE dulu: user existing diisi manual satu-satu oleh Admin
--     Cabang lewat UI sebelum cutover final. WAJIB terisi sebelum tombol Google
--     dihapus (Langkah 6 rollout).
--   - `password_hash` SUDAH ADA di schema.sql (format scrypt "salt:hashHex",
--     lihat lib/password.ts). TIDAK diubah di sini — tetap scrypt.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- USERS: kolom baru untuk NIK + jenis akun + nama tampilan atribusi.
-- ---------------------------------------------------------------------------

-- NIK: identifier login baru. NULLABLE selama migrasi (diisi manual). UNIQUE
-- ditegakkan lewat index parsial (abaikan baris ber-NIK NULL) supaya banyak
-- user lama tanpa NIK tidak saling bentrok di "NULL".
alter table users add column if not exists nik text;
create unique index if not exists users_nik_unique_idx on users (nik) where nik is not null;

-- Jenis akun: 'individual' (default, identitas personal) atau 'general' (satu
-- akun bersama per Drop Point, tanpa identitas personal — aktivitasnya dicatat
-- sebagai nama DP).
alter table users add column if not exists tipe_akun text not null default 'individual';
-- Constraint dibuat terpisah + idempoten (Postgres tak punya ADD CONSTRAINT IF
-- NOT EXISTS sebelum 15; pola DO-block ini aman di semua versi).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_tipe_akun_check'
  ) then
    alter table users
      add constraint users_tipe_akun_check check (tipe_akun in ('individual', 'general'));
  end if;
end $$;

-- Nama tampilan: yang DITULIS ke Activity_Log/atribusi.
--   - akun individual  -> sama dengan `nama` (nama orang)
--   - akun general      -> "DP [KODE_DP]" (mis. "DP BATANG01"), BUKAN nama orang
alter table users add column if not exists nama_tampilan text;

-- Backfill: user individual existing -> nama_tampilan = nama (sekali jalan;
-- baris yang sudah terisi tidak ditimpa).
update users set nama_tampilan = nama where nama_tampilan is null;

-- ---------------------------------------------------------------------------
-- LOGIN_ATTEMPTS: rate limiting percobaan login per NIK (anti brute-force —
-- kompensasi hilangnya 2FA Google). Berbasis DB supaya konsisten lintas
-- instance serverless (Vercel), bukan in-memory. Logika: maksimal 5 gagal
-- berturut-turut dalam 15 menit -> `locked_until` di-set; login sukses
-- me-reset baris. Penegakan window/threshold ada di API layer.
-- ---------------------------------------------------------------------------
create table if not exists login_attempts (
  nik          text primary key,
  failed_count int         not null default 0,
  locked_until timestamptz,                     -- null = tidak terkunci
  updated_at   timestamptz not null default now()
);

-- ============================================================================
-- CATATAN AKUN GENERAL (dibuat lewat UI di Langkah 4, BUKAN di SQL ini):
--   satu baris users per Drop Point dengan:
--     tipe_akun     = 'general'
--     role          = 'Admin DP'
--     drop_point    = <KODE_DP>
--     nik           = 'GENERAL-<KODE_DP>'   (unik)
--     nama_tampilan = 'DP <KODE_DP>'
--     email         = placeholder deterministik (mis. 'general-<kode_dp>@ltms.local')
--                     — WAJIB terisi karena `email` masih PRIMARY KEY & target
--                       FK favorite_feedback; TAK PERNAH dipakai login (login
--                       general lewat NIK). Bukan email personal.
--     password_hash = di-set Admin Cabang saat membuat akun.
-- ============================================================================
