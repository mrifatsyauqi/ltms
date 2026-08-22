-- ============================================================================
-- DROP POINT KECAMATAN — Migrasi data (parsing wilayah lama -> baris terstruktur)
--
-- WAJIB dijalankan SETELAH drop_point_kecamatan_migration.sql (skema) berhasil
-- dijalankan. JANGAN jalankan STEP B (INSERT) sebelum meninjau hasil STEP A -
-- terutama A3 (bentrok). Kecamatan yang BENTROK (parsing menunjukkan ada di
-- >1 Kode DP) TIDAK akan ditebak/di-insert otomatis oleh STEP B - harus
-- diputuskan manual lalu diisi lewat UI baru (Langkah 5) setelah migrasi ini.
--
-- Cara pakai (Supabase Dashboard -> SQL Editor):
--   1) Jalankan STEP A (3 query SELECT) satu per satu, tinjau hasilnya.
--   2) Catat kode_dp / kecamatan yang muncul di A1 (wilayah kosong) dan A3
--      (bentrok) - baris ini TIDAK akan terisi otomatis oleh STEP B.
--   3) Jalankan STEP B (INSERT) - aman dijalankan ulang (ON CONFLICT DO NOTHING,
--      idempotent).
--   4) Jalankan STEP C (verifikasi) untuk konfirmasi hasil akhir & daftar DP
--      yang masih perlu diisi manual.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP A — DIAGNOSTIK (read-only, jalankan & tinjau dulu, JANGAN dilewati)
-- ----------------------------------------------------------------------------

-- A1) Drop Point dengan wilayah KOSONG/NULL - tidak ada apa pun untuk
--     di-parse, WAJIB diisi manual lewat UI baru setelah migrasi.
select kode_dp, nama_dp, wilayah
from master_drop_point
where wilayah is null or btrim(wilayah) = ''
order by kode_dp;

-- A2) Preview hasil parsing (comma-split, trim, uppercase) - tinjau apakah
--     polanya konsisten atau ada anomali (mis. dipisah titik-koma, ada baris
--     kosong di antara koma, penulisan ganda, dsb) sebelum lanjut ke insert.
select
  kode_dp,
  nama_dp,
  wilayah as wilayah_asli,
  upper(btrim(k)) as kecamatan_parsed
from master_drop_point,
  lateral unnest(string_to_array(wilayah, ',')) as k
where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
order by kode_dp, kecamatan_parsed;

-- A3) BENTROK — kecamatan yang sama muncul di lebih dari satu kode_dp setelah
--     di-parse. INI PALING PENTING: baris ini TIDAK akan di-insert otomatis
--     oleh STEP B (supaya tidak menebak DP mana yang benar) - wajib
--     diputuskan manual lalu diisi lewat UI setelah migrasi ini.
with parsed as (
  select distinct
    kode_dp,
    upper(btrim(k)) as kecamatan
  from master_drop_point,
    lateral unnest(string_to_array(wilayah, ',')) as k
  where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
)
select
  kecamatan,
  array_agg(kode_dp order by kode_dp) as kode_dp_bentrok,
  count(*) as jumlah_dp
from parsed
group by kecamatan
having count(*) > 1
order by kecamatan;

-- ----------------------------------------------------------------------------
-- STEP B — INSERT (hanya kecamatan yang TIDAK bentrok & tidak kosong)
--          Aman dijalankan ulang (ON CONFLICT DO NOTHING).
-- ----------------------------------------------------------------------------
with parsed as (
  select distinct
    kode_dp,
    upper(btrim(k)) as kecamatan
  from master_drop_point,
    lateral unnest(string_to_array(wilayah, ',')) as k
  where wilayah is not null and btrim(wilayah) <> '' and btrim(k) <> ''
),
bentrok as (
  select kecamatan
  from parsed
  group by kecamatan
  having count(*) > 1
)
insert into drop_point_kecamatan (kode_dp, kecamatan)
select p.kode_dp, p.kecamatan
from parsed p
left join bentrok b on b.kecamatan = p.kecamatan
where b.kecamatan is null
on conflict (kecamatan) do nothing;

-- ----------------------------------------------------------------------------
-- STEP C — VERIFIKASI HASIL (jalankan setelah STEP B)
-- ----------------------------------------------------------------------------

-- C1) Ringkasan jumlah Kecamatan yang berhasil masuk per DP.
select kode_dp, count(*) as jumlah_kecamatan
from drop_point_kecamatan
group by kode_dp
order by kode_dp;

-- C2) Sanity check tambahan - harus 0 baris (constraint UNIQUE(kecamatan)
--     sudah menjamin ini, query ini cuma verifikasi eksplisit).
select kecamatan, count(*)
from drop_point_kecamatan
group by kecamatan
having count(*) > 1;

-- C3) Drop Point yang BELUM punya satu pun baris Kecamatan setelah migrasi -
--     gabungan dari (a) wilayah kosong dari awal (lihat A1), dan/atau
--     (b) semua kecamatan miliknya ternyata bentrok dan dilewati (lihat A3).
--     WAJIB diisi manual lewat UI Master Drop Point setelah Langkah 5 selesai.
select mdp.kode_dp, mdp.nama_dp, mdp.wilayah
from master_drop_point mdp
left join drop_point_kecamatan dpk on dpk.kode_dp = mdp.kode_dp
where dpk.id is null
order by mdp.kode_dp;
