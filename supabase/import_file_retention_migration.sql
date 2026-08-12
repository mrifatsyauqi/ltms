-- ---------------------------------------------------------------------------
-- Retensi file asli Import Long Tail (7 hari, auto-delete via cron harian).
-- Sebelumnya file Excel yang diupload di halaman Import HANYA diparse di
-- browser (baris-nya dikirim sbg JSON ke /api/import) - byte file aslinya
-- tidak pernah disimpan sama sekali, jadi tidak bisa diunduh ulang. Fitur ini
-- menyimpan file ASLI (bukan hasil parse) ke Supabase Storage, terkait ke
-- baris import_batch yang sudah ada, dan otomatis dihapus setelah 7 hari
-- (lihat cleanupExpiredImportFiles, dipanggil dari cron /api/cron/snapshot).
--
-- Jalankan di Supabase SQL Editor SEBELUM fitur "unduh file asli Import Long
-- Tail" dipakai - tanpa ini, endpoint upload/download akan gagal.
-- ---------------------------------------------------------------------------

-- Bucket PRIVATE (public: false) - semua akses lewat API server (service_role
-- key via db(), lihat lib/data/supabase/client.ts), tidak ada URL publik.
insert into storage.buckets (id, name, public)
values ('import-files', 'import-files', false)
on conflict (id) do nothing;

-- Satu baris per file ASLI yang diupload dalam satu batch import (satu batch
-- bisa berisi >1 file - lihat import-client.tsx, beberapa file digabung jadi
-- satu panggilan /api/import). batch_id mereferensi import_batch yang sudah
-- ada (primary key text) - dihapus otomatis (cascade) kalau baris batch-nya
-- suatu saat dihapus manual.
create table if not exists import_batch_file (
  id uuid primary key default gen_random_uuid(),
  batch_id text not null references import_batch(batch_id) on delete cascade,
  nama_file text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists import_batch_file_batch_id_idx on import_batch_file (batch_id);
-- Dipakai cron cleanup harian utk cari file yg sudah lewat 7 hari.
create index if not exists import_batch_file_created_at_idx on import_batch_file (created_at);
