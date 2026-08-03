-- ============================================================================
-- Migrasi: Tambah Menu Key 'monitoring_inc' (Monitoring Inter City)
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
  ('Admin Cabang', 'monitoring_inc', true),
  ('Manager Kota', 'monitoring_inc', true),
  ('Asisten Manager Kota', 'monitoring_inc', true),
  ('SPV Drop Point', 'monitoring_inc', true),
  ('Admin DP', 'monitoring_inc', true)
ON CONFLICT (role, menu_key) DO NOTHING;
