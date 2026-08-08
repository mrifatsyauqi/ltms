-- ============================================================================
-- Migrasi: Tambah Menu Key 'laporan_harian' (Laporan Harian Operasional DP)
-- Additive & idempotent (aman dijalankan ulang) - pola SAMA PERSIS dgn
-- monitoring_inc_migration.sql (constraint drop+recreate, lalu seed default
-- enabled=true utk role yang relevan). TIDAK WAJIB dijalankan supaya fitur
-- berfungsi (getMyMenuAccess() sudah fallback ke true utk menu_key tanpa
-- baris tersimpan - lihat permissions.ts), tapi WAJIB dijalankan sebelum
-- Admin mencoba menonaktifkan menu ini lewat Role & Akses (kalau belum
-- dijalankan, toggle "false" akan gagal krn ditolak CHECK constraint lama).
-- ============================================================================

-- 1. Perbarui CHECK constraint pada role_permissions & user_permissions
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_menu_key_check;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_menu_key_check CHECK (
  menu_key IN (
    'dashboard',
    'feedback_longtail_view',
    'feedback_longtail_edit',
    'data_longtail',
    'import_longtail',
    'monitoring_delivery_dp',
    'monitoring_delivery_cabang',
    'monitoring_inc',
    'laporan_harian',
    'master_cabang',
    'master_drop_point',
    'master_feedback',
    'user_management',
    'riwayat_import',
    'riwayat_feedback',
    'pengaturan',
    'role_akses'
  )
);

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS user_permissions_menu_key_check;
ALTER TABLE user_permissions ADD CONSTRAINT user_permissions_menu_key_check CHECK (
  menu_key IN (
    'dashboard',
    'feedback_longtail_view',
    'feedback_longtail_edit',
    'data_longtail',
    'import_longtail',
    'monitoring_delivery_dp',
    'monitoring_delivery_cabang',
    'monitoring_inc',
    'laporan_harian',
    'master_cabang',
    'master_drop_point',
    'master_feedback',
    'user_management',
    'riwayat_import',
    'riwayat_feedback',
    'pengaturan',
    'role_akses'
  )
);

-- 2. Masukkan default permission (enabled = true) untuk semua role yang relevan
INSERT INTO role_permissions (role, menu_key, enabled)
VALUES
  ('Admin Cabang', 'laporan_harian', true),
  ('Manager Kota', 'laporan_harian', true),
  ('Asisten Manager Kota', 'laporan_harian', true),
  ('SPV Drop Point', 'laporan_harian', true),
  ('Admin DP', 'laporan_harian', true)
ON CONFLICT (role, menu_key) DO NOTHING;
