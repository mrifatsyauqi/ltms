-- ============================================================================
-- LTMS — Seed data awal ke Supabase (mulai fresh: master data saja).
-- Jalankan di Supabase SQL Editor SETELAH schema.sql.
--
-- WAJIB minimal: 1 akun Admin Cabang supaya bisa login & akses data lewat
-- backend Supabase. Email HARUS lowercase (dibandingkan lowercase di kode).
-- ============================================================================

-- Akun admin utama (sesuaikan email/nama bila perlu). jabatan_id wajib diisi
-- (NOT NULL) - dicocokkan by nama ke tabel jabatan yang di-seed schema.sql.
insert into users (email, nama, role, drop_point, jabatan_id, status_aktif)
values (
  'm.rifatsyauqii@gmail.com', 'M. Rifat Syauqi', 'Admin Cabang', null,
  (select id from jabatan where nama = 'Admin Cabang'),
  true
)
on conflict (email) do nothing;

-- Tambahkan user lain di sini bila perlu, contoh Admin DP:
-- insert into users (email, nama, role, drop_point, jabatan_id, status_aktif)
-- values (
--   'admin.dp@gmail.com', 'Nama Admin DP', 'Admin DP', 'BATANG01',
--   (select id from jabatan where nama = 'Admin DP'),
--   true
-- )
-- on conflict (email) do nothing;

-- Master Drop Point & Master Feedback bisa kamu isi lewat aplikasi (halaman
-- Master) setelah backend Supabase aktif, atau tambahkan di sini bila mau.
-- Contoh:
-- insert into master_drop_point (kode_dp, nama_dp, wilayah, status_aktif)
-- values ('BATANG01', 'BATANG01', 'Batang', true) on conflict do nothing;
