-- ============================================================================
-- SUPER ADMIN — SATU akun untuk M. Rifat Syauqi. TIDAK DIEKSEKUSI OTOMATIS
-- dari sesi ini - jalankan sendiri di Supabase SQL Editor kapan siap.
--
-- Kenapa lewat SQL manual (bukan form User Management): Super Admin SENGAJA
-- TIDAK ADA di dropdown Jabatan (lihat ASSIGNABLE_ROLES di lib/roles.ts) -
-- mencegah privilege escalation via UI (mis. Admin Cabang lain iseng
-- membuat akun Super Admin lewat form kalau opsinya ada).
--
-- OPSI A (DIREKOMENDASIKAN) — promosikan akun existing Anda yang sudah ada
-- (m.rifatsyauqii@gmail.com, sudah Admin Cabang) jadi Super Admin. Setelah
-- ini dijalankan, NIK & password TETAP BISA diatur lewat UI biasa (tombol
-- Edit & Set Password di User Management - keduanya TIDAK dibatasi role),
-- jadi SQL ini cukup ganti role + jabatan_id saja:
-- ============================================================================
update users
set
  role = 'Super Admin',
  jabatan_id = (select id from jabatan where nama = 'Super Admin')
where email = 'm.rifatsyauqii@gmail.com';

-- ============================================================================
-- OPSI B — kalau Anda lebih suka Super Admin sbg akun TERPISAH (bukan
-- promosi akun Admin Cabang yang sudah ada), sesuaikan email/nama/NIK lalu
-- jalankan INSERT ini SEBAGAI GANTI Opsi A di atas (bukan keduanya):
-- ============================================================================
-- insert into users (email, nama, role, drop_point, jabatan_id, status_aktif)
-- values (
--   'superadmin@ltms.local', 'M. Rifat Syauqi', 'Super Admin', null,
--   (select id from jabatan where nama = 'Super Admin'),
--   true
-- )
-- on conflict (email) do nothing;
-- -- Set NIK & password awal utk akun baru ini lewat UI (Edit + Set Password)
-- -- setelah baris ini ada, sama seperti akun manapun.
