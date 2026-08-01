-- ============================================================================
-- ROLE & AKSES — perluas hierarki siapa-mengatur-siapa (revisi dari
-- role_permissions_migration.sql): Super Admin sekarang bisa atur SEMUA role
-- di bawahnya (Admin Cabang, Manager Kota, Asisten Manager Kota, SPV Drop
-- Point, Admin DP) - sebelumnya cuma SPV Drop Point/Admin DP yang masuk
-- matrix, Admin Cabang/Manager Kota/Asisten Manager Kota hardcode bypass.
--
-- Admin Cabang/Manager Kota/Asisten Manager Kota TETAP HANYA bisa atur SPV
-- Drop Point/Admin DP (tidak berubah) - TIDAK BISA lihat/atur kartu role
-- mereka sendiri di halaman Role & Akses (privilese eksklusif Super Admin).
-- Ditegakkan di kode (requireRole 'Super Admin' only utk 3 role baru), BUKAN
-- di skema - skema cuma memperluas CHECK constraint + kolom yg mengizinkan
-- baris utk 3 role baru ini ada.
--
-- role_permissions.role: 2 nilai -> 5 nilai.
-- role_permissions.menu_key & user_permissions.menu_key: 4 nilai -> 15 nilai
-- (11 menu_key BARU khusus cakupan sidebar Admin Cabang/Manager Kota/
-- Asisten Manager Kota yang jauh lebih luas dari SPV DP/Admin DP - lihat
-- daftar lengkap di bawah). SPV Drop Point/Admin DP TIDAK diseed menu_key
-- baru ini - tetap PERSIS 4 seperti sebelumnya, tidak berubah.
--
-- Seed BARU: (Admin Cabang, Manager Kota, Asisten Manager Kota) x (SEMUA 15
-- menu_key) = 3 x 15 = 45 baris, SEMUA enabled=true - WAJIB supaya TIDAK ADA
-- perubahan akses/perilaku terlihat begitu fitur ini live (cegah lockout).
-- Super Admin baru menonaktifkan sesuatu KALAU dia sengaja memilih itu lewat
-- UI Role & Akses setelah migrasi ini, bukan otomatis dibatasi.
--
-- Additive & idempotent - aman dijalankan ulang (constraint di-drop+re-add
-- ke definisi yg SAMA kalau dijalankan 2x, seed pakai ON CONFLICT DO NOTHING).
-- ============================================================================

-- ---- Perluas CHECK role_permissions.role: 2 -> 5 nilai ---------------------
do $$
declare
  cn text;
begin
  select c.conname into cn
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'role_permissions'::regclass
    and c.contype = 'c'
    and a.attname = 'role'
    and array_length(c.conkey, 1) = 1;

  if cn is not null then
    execute format('alter table role_permissions drop constraint %I', cn);
  end if;
end $$;

alter table role_permissions add constraint role_permissions_role_check
  check (role in (
    'Admin Cabang',
    'Manager Kota',
    'Asisten Manager Kota',
    'SPV Drop Point',
    'Admin DP'
  ));

-- ---- Perluas CHECK menu_key di role_permissions & user_permissions: 4 -> 15 nilai ----
-- Daftar lengkap 15 menu_key (union lama + baru):
--   dashboard, feedback_longtail_view, feedback_longtail_edit (4 lama,
--   dipakai SPV Drop Point/Admin DP + Admin Cabang dkk) + data_longtail,
--   import_longtail, monitoring_delivery_dp, monitoring_delivery_cabang,
--   master_cabang, master_drop_point, master_feedback, user_management,
--   riwayat_import, pengaturan, role_akses (11 baru, khusus cakupan sidebar
--   Admin Cabang/Manager Kota/Asisten Manager Kota - SPV Drop Point/Admin DP
--   TIDAK memakainya, lihat catatan seed di bawah) + riwayat_feedback (lama).
do $$
declare
  cn text;
begin
  select c.conname into cn
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'role_permissions'::regclass
    and c.contype = 'c'
    and a.attname = 'menu_key'
    and array_length(c.conkey, 1) = 1;

  if cn is not null then
    execute format('alter table role_permissions drop constraint %I', cn);
  end if;
end $$;

alter table role_permissions add constraint role_permissions_menu_key_check
  check (menu_key in (
    'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
    'data_longtail', 'import_longtail',
    'monitoring_delivery_dp', 'monitoring_delivery_cabang',
    'master_cabang', 'master_drop_point', 'master_feedback', 'user_management',
    'riwayat_import', 'riwayat_feedback',
    'pengaturan', 'role_akses'
  ));

do $$
declare
  cn text;
begin
  select c.conname into cn
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
  where c.conrelid = 'user_permissions'::regclass
    and c.contype = 'c'
    and a.attname = 'menu_key'
    and array_length(c.conkey, 1) = 1;

  if cn is not null then
    execute format('alter table user_permissions drop constraint %I', cn);
  end if;
end $$;

alter table user_permissions add constraint user_permissions_menu_key_check
  check (menu_key in (
    'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit',
    'data_longtail', 'import_longtail',
    'monitoring_delivery_dp', 'monitoring_delivery_cabang',
    'master_cabang', 'master_drop_point', 'master_feedback', 'user_management',
    'riwayat_import', 'riwayat_feedback',
    'pengaturan', 'role_akses'
  ));

-- ---- Seed: (Admin Cabang, Manager Kota, Asisten Manager Kota) x (15 menu_key) = 45 baris, semua true ----
insert into role_permissions (role, menu_key, enabled)
select r.role, k.menu_key, true
from (values ('Admin Cabang'), ('Manager Kota'), ('Asisten Manager Kota')) as r(role),
     (values
       ('dashboard'), ('feedback_longtail_view'), ('feedback_longtail_edit'),
       ('data_longtail'), ('import_longtail'),
       ('monitoring_delivery_dp'), ('monitoring_delivery_cabang'),
       ('master_cabang'), ('master_drop_point'), ('master_feedback'), ('user_management'),
       ('riwayat_import'), ('riwayat_feedback'),
       ('pengaturan'), ('role_akses')
     ) as k(menu_key)
on conflict (role, menu_key) do nothing;
