-- ============================================================================
-- JABATAN — Tahap 3b: terapkan NOT NULL di users.jabatan_id.
--
-- HANYA dijalankan setelah jabatan_backfill.sql dikonfirmasi: query
-- verifikasi #2 (akun gagal ter-backfill) kosong. Sudah dikonfirmasi:
-- 14 akun (3 Admin Cabang + 11 Admin DP) semua ter-assign, 0 gagal.
--
-- Catatan: FK jabatan_id pakai "on delete set null" (lihat
-- jabatan_migration.sql) - kombinasi dgn NOT NULL di sini artinya
-- MENGHAPUS baris jabatan yang masih dipakai akun akan GAGAL (trigger FK
-- coba set null, lalu ditolak constraint NOT NULL) - sengaja, jaring
-- pengaman supaya jabatan yang masih aktif dipakai tak bisa terhapus
-- tanpa sadar.
-- ============================================================================

alter table users alter column jabatan_id set not null;
