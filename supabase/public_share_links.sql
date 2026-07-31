-- ============================================================================
-- LTMS — Link Berbagi Laporan (Dashboard + Data Long Tail, read-only, tanpa
-- login, dibagikan lewat chat). File TERPISAH dari schema.sql SENGAJA:
-- schema.sql men-drop SEMUA tabel (users, longtail, dst) di bagian atas -
-- aman untuk setup awal/dev, tapi KATASTROFIK kalau di-re-run apa adanya
-- terhadap database PRODUKSI yang sudah berisi data nyata (migrasi Supabase
-- sudah live). File ini HANYA menyentuh 2 tabel baru di bawah - aman
-- dijalankan berdiri sendiri via Supabase SQL Editor tanpa risiko data lama
-- ikut terhapus.
--
-- Cara pakai: Supabase Dashboard -> SQL Editor -> New query -> tempel file
-- ini -> Run. Aman dijalankan ulang (idempotent, DROP IF EXISTS hanya utk 2
-- tabel ini).
-- ============================================================================

drop table if exists public_share_access_log cascade;
drop table if exists public_share_links       cascade;

-- ---------------------------------------------------------------------------
-- PUBLIC_SHARE_LINKS: token PERMANEN (tanpa expired_at) sampai di-revoke
-- manual atau di-regenerate (revoke lama + buat token baru sekaligus).
-- Hanya Admin Cabang yang generate/kelola (ditegakkan di layer API, PRD
-- Bagian 5) - `dibuat_oleh` sekadar jejak, bukan FK (konsisten dgn pola
-- import_batch.admin_cabang/activity_log.user_email di schema.sql, bukan
-- favorite_feedback yg memang punya alasan relasional berbeda).
--
-- Unique index parsial `public_share_links_one_active_idx`: menegakkan "cuma
-- 1 link aktif (revoked=false) pada satu waktu" LANGSUNG di level DB, sesuai
-- aturan bisnis (generate baru diblokir kalau sudah ada yg aktif; regenerate
-- WAJIB revoke lama dulu sebelum insert baru) - bukan cuma diandalkan dari
-- logic aplikasi, supaya race condition/bug tak bisa menghasilkan 2 link
-- aktif sekaligus.
-- ---------------------------------------------------------------------------
create table public_share_links (
  token       text primary key
              check (token ~ '^[0-9a-f]{32}$'),  -- 32 hex char, crypto random (bukan UUID sekuensial/tebakable)
  dibuat_oleh text not null,                      -- email Admin Cabang
  revoked     boolean not null default false,
  created_at  timestamptz not null default now()
);

create unique index public_share_links_one_active_idx
  on public_share_links ((true))
  where revoked = false;

-- ---------------------------------------------------------------------------
-- PUBLIC_SHARE_ACCESS_LOG: 1 baris per akses ke salah satu halaman publik -
-- sumber "Jumlah akses total per halaman" & "Akses 7 hari terakhir" di UI
-- Kelola Link Laporan (deteksi anomali/lonjakan). `token` TIDAK cascade-drop
-- link-nya (arahnya kebalik: hapus baris log kalau token induknya dihapus -
-- tapi token TAK PERNAH dihapus, hanya di-set revoked, jadi histori akses
-- token lama tetap tersimpan utuh walau linknya sudah di-regenerate).
-- ---------------------------------------------------------------------------
create table public_share_access_log (
  id          bigint generated always as identity primary key,
  token       text not null references public_share_links(token) on delete cascade,
  halaman     text not null check (halaman in ('dashboard', 'data-longtail')),
  accessed_at timestamptz not null default now(),
  ip_address  text,
  user_agent  text
);

-- Komposit (token, accessed_at desc): cukup utk kedua pola query UI Kelola
-- Link Laporan - total per token (+filter halaman) & N hari terakhir per
-- token - tanpa perlu index terpisah per kolom.
create index public_share_access_log_token_accessed_idx
  on public_share_access_log (token, accessed_at desc);
