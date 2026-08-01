-- ============================================================================
-- CABANG (Kota) — Pengaturan Cabang & restrukturisasi Drop Point per Kota.
--
-- Additive & idempotent (aman dijalankan ulang), TIDAK menyentuh tabel/kolom
-- yang sudah ada. Jalankan di Supabase Dashboard -> SQL Editor -> Run.
--
-- Catatan desain (lihat diskusi audit sebelum file ini dibuat):
--   - `users.id` (uuid) ditambahkan sebagai identitas stabil untuk FK baru
--     di bawah, TANPA mencopot `email` sebagai primary key (email masih
--     dipakai FK nyata di favorite_feedback.email_admin_dp — migrasi PK
--     penuh di luar scope & berisiko tinggi).
--   - "Admin Drop Point" TIDAK dapat kolom/tabel baru — REUSE mekanisme
--     existing (users.role='Admin DP' + users.drop_point=kode_dp). Tidak ada
--     unique constraint yang menjamin 1 DP = 1 Admin DP (celah desain lama,
--     SENGAJA tidak diperbaiki di migrasi ini — di luar scope, berisiko ke
--     data existing). Kode aplikasi menampilkan ini apa adanya sbg daftar
--     (bisa 0/1/banyak), bukan asumsi selalu satu.
--   - `master_drop_point.kode_kota` nullable supaya DP existing tetap
--     tampil normal (dikelompokkan "Belum ada Kota") sampai di-assign
--     manual oleh Admin Cabang lewat UI.
-- ============================================================================

-- 1) Prasyarat: id stabil di users (lihat catatan desain di atas)
alter table users add column if not exists id uuid not null default gen_random_uuid();
create unique index if not exists users_id_unique_idx on users (id);

-- 2) CABANG (Kota)
create table if not exists cabang (
  kode_kota                text primary key,
  nama_kota                text not null,
  manager_kota_user_id     uuid references users(id) on delete set null,
  asisten_manager_user_id  uuid references users(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
drop trigger if exists cabang_updated on cabang;
create trigger cabang_updated before update on cabang
  for each row execute function set_updated_at();

-- 3) master_drop_point: assign ke Kota + SPV Drop Point (nullable, migrasi
--    data existing aman - tidak ada baris DP yang hilang/error)
alter table master_drop_point add column if not exists kode_kota text references cabang(kode_kota) on delete set null;
alter table master_drop_point add column if not exists spv_drop_point_user_id uuid references users(id) on delete set null;
create index if not exists master_drop_point_kode_kota_idx on master_drop_point (kode_kota);
