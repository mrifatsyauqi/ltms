-- ============================================================================
-- MONITORING DELIVERY — tambah menu_key 'monitoring_delivery_dp' ke
-- role_permissions utk SPV Drop Point & Admin DP. Menu_key ini SUDAH ada di
-- CHECK constraint (bagian dari 15 nilai, lihat role_akses_hierarchy_migration.sql)
-- TAPI BELUM diseed utk 2 role ini - seed original mereka cuma 4 menu_key
-- (dashboard, feedback_longtail_view, feedback_longtail_edit,
-- riwayat_feedback), Monitoring Delivery sengaja dikecualikan waktu itu.
--
-- Sekarang mode per-Sprinter Monitoring Delivery (fitur yang sudah ada sejak
-- awal, dipakai SPV Drop Point & Admin DP) mau digating lewat matrix juga -
-- dipasangkan dgn 'monitoring_delivery_cabang' yang jadi milik Admin
-- Cabang/Manager Kota/Asisten Manager Kota (mode "Refine Total" per DP,
-- sudah diseed true di role_akses_hierarchy_migration.sql).
--
-- Seed enabled=true - Admin DP existing (sudah lama pakai fitur ini) TIDAK
-- BOLEH terputus aksesnya begitu menu_key ini mulai ditegakkan.
--
-- Additive & idempotent (ON CONFLICT DO NOTHING) - aman dijalankan ulang.
-- ============================================================================

insert into role_permissions (role, menu_key, enabled)
select r.role, 'monitoring_delivery_dp', true
from (values ('SPV Drop Point'), ('Admin DP')) as r(role)
on conflict (role, menu_key) do nothing;
