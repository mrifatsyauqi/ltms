-- ============================================================================
-- JABATAN — Tahap 3: seed 6 baris + backfill users.jabatan_id dari role
-- existing. Additive & idempotent (aman dijalankan ulang - INSERT pakai
-- ON CONFLICT DO NOTHING, UPDATE cuma menyentuh baris yang jabatan_id-nya
-- masih null).
--
-- PENTING: file ini TIDAK menerapkan NOT NULL di jabatan_id - itu ADA DI
-- FILE TERPISAH (jabatan_not_null.sql), HANYA dijalankan setelah query
-- verifikasi di bagian bawah dicek dan dikonfirmasi NOL akun gagal.
--
-- Backfill cocokkan by nama persis (role text -> jabatan.nama). Karena
-- kolom users.role di produksi cuma pernah berisi 'Admin Cabang'/'Admin DP'
-- (lihat audit constraint), 4 jabatan lain (Super Admin, Manager Kota,
-- Asisten Manager Kota, SPV Drop Point) WAJAR menunjukkan 0 akun di query
-- verifikasi #1 - itu bukan kegagalan, cuma belum ada akun yang di-assign
-- ke jabatan itu (assignment jabatan tsb dilakukan manual belakangan lewat
-- form Tambah/Edit User, Tahap 4).
-- ============================================================================

insert into jabatan (nama, tingkat, deskripsi) values
  ('Super Admin',           1, null),
  ('Admin Cabang',          2, null),
  ('Manager Kota',          3, null),
  ('Asisten Manager Kota',  4, null),
  ('SPV Drop Point',        5, null),
  ('Admin DP',              6, null)
on conflict (nama) do nothing;

update users u
set jabatan_id = j.id
from jabatan j
where j.nama = u.role
  and u.jabatan_id is null;

-- ---------------------------------------------------------------------------
-- VERIFIKASI #1 — jumlah akun per jabatan setelah backfill (termasuk
-- jabatan yang belum ada akunnya sama sekali, count = 0).
-- ---------------------------------------------------------------------------
select j.tingkat, j.nama, count(u.email) as jumlah_akun
from jabatan j
left join users u on u.jabatan_id = j.id
group by j.id, j.nama, j.tingkat
order by j.tingkat;

-- ---------------------------------------------------------------------------
-- VERIFIKASI #2 — akun yang GAGAL ter-backfill (jabatan_id masih null
-- setelah UPDATE di atas). HARUS KOSONG sebelum lanjut ke NOT NULL.
-- ---------------------------------------------------------------------------
select email, nama, role, jabatan_id
from users
where jabatan_id is null;
