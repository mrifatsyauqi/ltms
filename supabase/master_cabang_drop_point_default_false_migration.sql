-- Perubahan KEBIJAKAN DEFAULT (bukan bug fix): menu_key 'master_cabang' dan
-- 'master_drop_point' untuk Admin Cabang/Manager Kota/Asisten Manager Kota
-- berubah dari default enabled=true menjadi enabled=false. Mengelola
-- struktur Kota antar cabang jadi tanggung jawab EKSKLUSIF Super Admin
-- secara default - 3 role ini TIDAK dihapus dari matrix, masih tetap bisa
-- dilihat/diatur di halaman Role & Akses oleh Super Admin, dan tetap bisa
-- DINYALAKAN per-akun lewat mode "Per Akun" utk kasus khusus.
--
-- TIDAK ADA perubahan skema (CHECK constraint, kolom, dll) - murni UPDATE
-- data di role_permissions. TIDAK PERLU perubahan kode: hasPermission()/
-- getMyMenuAccess()/filterNavByAccess() yang sudah ada otomatis mengikuti
-- nilai baru di database begitu baris ini berubah.
--
-- URUTAN WAJIB: jalankan Langkah 1 (SELECT) DULU dan tinjau hasilnya
-- sebelum menjalankan Langkah 2 (UPDATE) - akun mana pun yang muncul di
-- Langkah 1 SUDAH punya override individual (user_permissions), jadi
-- akses mereka TIDAK berubah oleh UPDATE ini (override menang atas
-- default role, prioritas resolusi tak berubah) - tapi baik untuk tahu
-- lebih dulu siapa saja itu sebelum melihat efek massal ke akun lain.
--
-- Divalidasi terhadap Postgres 16 lokal (skema fresh dari schema.sql +
-- baris user_permissions tiruan) sebelum diserahkan utk review:
--  - UPDATE tepat mengenai 6 baris (3 role x 2 menu_key), tak lebih tak
--    kurang - dibuktikan lewat count role_permissions SEBELUM/SESUDAH
--    (55 -> 55, cuma nilai enabled yang berubah, tak ada baris
--    ditambah/dihapus).
--  - SPV Drop Point/Admin DP tak tersentuh sama sekali (mereka memang tak
--    pernah punya baris master_cabang/master_drop_point).
--  - menu_key lain (dashboard, master_feedback, user_management, dst) utk
--    role yang sama tak ikut berubah.
--  - baris user_permissions override yang sudah ada SEBELUM UPDATE ini
--    (skenario akun "testac@ltms.test" dgn master_cabang=false individual)
--    terbukti TIDAK ikut tersentuh/diubah oleh UPDATE ini sama sekali.
--  - idempoten: dijalankan ulang persis sama (masih match 6 baris, tak
--    error, hasil akhir identik).

-- ============================================================================
-- LANGKAH 1 (JALANKAN DULU, TINJAU HASILNYA): akun mana saja yang SUDAH
-- pernah override master_cabang/master_drop_point secara individual,
-- utk role Admin Cabang/Manager Kota/Asisten Manager Kota. Akses akun-akun
-- ini TIDAK akan berubah oleh Langkah 2 (override tetap menang atas
-- default) - kosong = belum ada satu pun akun yang punya override khusus,
-- semuanya akan mengikuti default baru (false) apa adanya.
-- ============================================================================
select
  u.email,
  u.nama,
  u.role,
  up.menu_key,
  up.enabled as override_enabled,
  up.updated_at
from user_permissions up
join users u on u.id = up.user_id
where up.menu_key in ('master_cabang', 'master_drop_point')
  and u.role in ('Admin Cabang', 'Manager Kota', 'Asisten Manager Kota')
order by u.role, u.email, up.menu_key;

-- ============================================================================
-- LANGKAH 2 (JALANKAN SETELAH MENINJAU HASIL LANGKAH 1): balik default
-- role_permissions ke false. Efek LANGSUNG ke semua akun Admin Cabang/
-- Manager Kota/Asisten Manager Kota yang TIDAK muncul di daftar Langkah 1
-- (yang muncul di Langkah 1 tetap mengikuti override individualnya).
-- ============================================================================
update role_permissions
set enabled = false
where menu_key in ('master_cabang', 'master_drop_point')
  and role in ('Admin Cabang', 'Manager Kota', 'Asisten Manager Kota');

-- ============================================================================
-- LANGKAH 3 (VERIFIKASI SETELAH UPDATE): konfirmasi tepat 6 baris jadi
-- false, tak lebih tak kurang.
-- ============================================================================
select role, menu_key, enabled
from role_permissions
where menu_key in ('master_cabang', 'master_drop_point')
order by role, menu_key;
