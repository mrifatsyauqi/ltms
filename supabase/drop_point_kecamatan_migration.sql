-- ============================================================================
-- DROP POINT KECAMATAN — Pemetaan terpusat Kecamatan -> Kode DP.
--
-- Additive & idempotent (aman dijalankan ulang), TIDAK mengubah/menghapus
-- kolom master_drop_point.wilayah yang lama. Kolom itu dibiarkan apa adanya
-- sebagai referensi historis sampai UI diganti (lihat Langkah 5) - setelah
-- migrasi ini, `wilayah` TIDAK lagi dipakai sebagai sumber kebenaran oleh
-- fitur mana pun; satu-satunya sumber kebenaran Kecamatan -> Kode DP adalah
-- tabel baru ini.
--
-- Catatan desain:
--   - `kecamatan` disimpan dalam bentuk ternormalisasi (trim + UPPERCASE)
--     supaya pencocokan terhadap data Excel JMS ("Kecamatan Penerima",
--     kapitalisasi bebas) konsisten. Constraint CHECK di bawah menolak baris
--     yang tidak dinormalisasi lebih dulu (jaga-jaga bila ada bug di
--     aplikasi) - helper aplikasi WAJIB normalisasi (trim + toUpperCase())
--     sebelum insert/update maupun sebelum query pencocokan.
--   - UNIQUE(kecamatan) menegakkan aturan bisnis "1 Kecamatan hanya boleh
--     terdaftar di 1 Kode DP" di level database, bukan cuma di aplikasi.
--   - Satu Kode DP boleh punya banyak baris (banyak Kecamatan) - ini yang
--     mengakomodasi kasus 1 DP menangani banyak Kecamatan sekaligus.
--   - Logika bisnis Long Tail (import, dedup, freeze aging, Dashboard,
--     Feedback Long Tail) TIDAK disentuh sama sekali oleh migrasi ini -
--     tetap memakai Nama DP (`DP Sampai` dari tarikan JMS) seperti sekarang.
-- ============================================================================

create table if not exists drop_point_kecamatan (
  id          uuid primary key default gen_random_uuid(),
  kode_dp     text not null references master_drop_point(kode_dp) on delete cascade,
  kecamatan   text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint drop_point_kecamatan_kecamatan_unique unique (kecamatan),
  constraint drop_point_kecamatan_normalized check (kecamatan = upper(btrim(kecamatan)))
);

create index if not exists drop_point_kecamatan_kode_dp_idx on drop_point_kecamatan (kode_dp);

drop trigger if exists drop_point_kecamatan_updated on drop_point_kecamatan;
create trigger drop_point_kecamatan_updated before update on drop_point_kecamatan
  for each row execute function set_updated_at();
