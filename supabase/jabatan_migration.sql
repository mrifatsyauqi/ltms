-- ============================================================================
-- JABATAN — normalisasi role/label organisasi (Admin Cabang, Admin DP,
-- Manager Kota, dst) jadi entitas resmi dgn id, LEPAS dari kolom `role`
-- (text) yang sudah ada di users. Additive & idempotent.
--
-- PENTING: kolom users.role TETAP DIPERTAHANKAN (TIDAK dihapus) - dipakai
-- sbg fallback/cross-check selama masa transisi, sama seperti pola kolom
-- email yang dipertahankan saat migrasi NIK (lihat auth_nik_migration.sql).
-- Semua titik kode yang baca users.role (guard halaman, requireRole,
-- navForRole, filter cakupan dashboard/longtail, dst - lihat audit) TIDAK
-- disentuh di migrasi ini.
--
-- TAHAP INI CUMA BIKIN STRUKTUR (tabel jabatan kosong + kolom users.jabatan_id
-- nullable). Seed 6 baris jabatan + backfill jabatan_id dari role existing
-- ADA DI FILE TERPISAH (jabatan_backfill.sql), dijalankan SETELAH file ini
-- dikonfirmasi sukses. Constraint NOT NULL di jabatan_id JUGA belum
-- diterapkan di sini - lihat jabatan_not_null.sql, dijalankan HANYA setelah
-- hasil verifikasi backfill menunjukkan nol akun gagal ter-assign.
-- ============================================================================

create table if not exists jabatan (
  id        uuid primary key default gen_random_uuid(),
  nama      text not null unique,
  tingkat   integer not null,
  deskripsi text
);

alter table users add column if not exists jabatan_id uuid references jabatan(id) on delete set null;
create index if not exists users_jabatan_id_idx on users (jabatan_id);
