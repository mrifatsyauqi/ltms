-- ============================================================================
-- ROLE & AKSES — matrix menu per akun/role, HANYA utk 'SPV Drop Point' &
-- 'Admin DP' (2 role "diatur"). Super Admin/Admin Cabang/Manager Kota/
-- Asisten Manager Kota TIDAK PERNAH masuk matrix ini - akses mereka given/
-- hardcoded dari Langkah 3 (hasFullAccess di lib/roles.ts), tidak berubah
-- oleh fitur ini sama sekali.
--
-- 2 tabel baru:
--   role_permissions  - default per role (SPV Drop Point / Admin DP).
--   user_permissions  - override per akun individual (menimpa default HANYA
--                        utk akun itu; FK ke users.id, ON DELETE CASCADE).
--
-- menu_key dibatasi ke 4 menu yang memang dimiliki SPV DP/Admin DP di
-- sidebar (lib/nav.ts): dashboard, feedback_longtail_view,
-- feedback_longtail_edit, riwayat_feedback. Monitoring Delivery & Profil
-- SENGAJA tak masuk matrix - selalu accessible, tak pernah digating oleh
-- fitur ini (di luar cakupan task).
--
-- Seed awal: SEMUA true (persis perilaku existing dari Langkah 3) - supaya
-- TIDAK ADA perubahan visual/akses mendadak begitu fitur ini live. Matrix
-- baru berguna kalau nanti Admin Cabang/Manager Kota sengaja mematikan 1
-- menu utk 1 role atau 1 akun spesifik.
--
-- Additive & idempotent (create table if not exists, insert ... on conflict
-- do nothing) - aman dijalankan ulang.
-- ============================================================================

create table if not exists role_permissions (
  role       text not null check (role in ('SPV Drop Point', 'Admin DP')),
  menu_key   text not null check (menu_key in (
               'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit', 'riwayat_feedback'
             )),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (role, menu_key)
);

create table if not exists user_permissions (
  user_id    uuid not null references users(id) on delete cascade,
  menu_key   text not null check (menu_key in (
               'dashboard', 'feedback_longtail_view', 'feedback_longtail_edit', 'riwayat_feedback'
             )),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, menu_key)
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'role_permissions_updated') then
    create trigger role_permissions_updated before update on role_permissions
      for each row execute function set_updated_at();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'user_permissions_updated') then
    create trigger user_permissions_updated before update on user_permissions
      for each row execute function set_updated_at();
  end if;
end $$;

insert into role_permissions (role, menu_key, enabled)
select r.role, k.menu_key, true
from (values ('SPV Drop Point'), ('Admin DP')) as r(role),
     (values ('dashboard'), ('feedback_longtail_view'), ('feedback_longtail_edit'), ('riwayat_feedback')) as k(menu_key)
on conflict (role, menu_key) do nothing;
