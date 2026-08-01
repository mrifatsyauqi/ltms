-- ============================================================================
-- ROLE EXPANSION (Langkah 3) — perluas constraint users.role dari 2 nilai
-- jadi 6, memberi akses nyata pertama kali ke Manager Kota, Asisten Manager
-- Kota, SPV Drop Point, Super Admin (sebelumnya cuma label kosong di
-- jabatan_id - lihat jabatan_migration.sql).
--
-- Tidak ada tabel baru: jabatan (sudah ada, 6 baris) dan
-- master_drop_point.spv_drop_point_user_id (sudah ada) dipakai apa adanya.
--
-- Additive & idempotent. Mencari nama constraint check yang ada di kolom
-- role SECARA DINAMIS (bukan hardcode 'users_role_check') supaya migrasi
-- ini tetap aman dijalankan berapa kali pun / apa pun nama constraint-nya
-- saat ini.
-- ============================================================================

do $$
declare
  cn text;
begin
  select conname into cn
  from pg_constraint
  where conrelid = 'users'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%in%';

  if cn is not null then
    execute format('alter table users drop constraint %I', cn);
  end if;
end $$;

alter table users add constraint users_role_check
  check (role in (
    'Super Admin',
    'Admin Cabang',
    'Manager Kota',
    'Asisten Manager Kota',
    'SPV Drop Point',
    'Admin DP'
  ));
