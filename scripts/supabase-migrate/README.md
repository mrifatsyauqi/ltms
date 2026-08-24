# LTMS Supabase Migration Tool

Tool ini dirancang untuk memigrasikan skema dan data master khusus fitur **Push Mas Kurir** dari Preview ke Production, secara aman, bertahap, dan tanpa menyalin riwayat log/transaksi (seperti *testing batches*).

## Prasyarat
- PowerShell (Windows)
- PostgreSQL Client Tools (`psql` dan `pg_dump` harus terinstal dan berada dalam PATH).

## Konfigurasi
Salin `config.example.env` menjadi `config.env` dan isikan kredensial `postgresql://` untuk database Supabase Preview dan Production Anda.
**Pastikan jangan pernah melakukan commit file `config.env`!**

## Langkah-Langkah Migrasi (Sesuai Urutan)

1. **Audit Database:**
   ```powershell
   .\migrate.ps1 audit
   ```
   Menampilkan daftar tabel, perubahan skema, dan data yang dimigrasi (serta tidak dimigrasi).

2. **Backup Production Database:**
   ```powershell
   .\migrate.ps1 backup
   ```
   Melakukan backup otomatis skema *Production* ke folder `backups/`.

3. **Migrate to Production:**
   ```powershell
   .\migrate.ps1 migrate
   ```
   Akan meminta konfirmasi `MIGRATE PRODUCTION`. Menjalankan file `02-schema-migration.sql` yang didesain 100% aman (menggunakan DDL *Idempotent* seperti `IF NOT EXISTS`, dll) ke *Production*.

4. **Verify Production:**
   ```powershell
   .\migrate.ps1 verify
   ```
   Melakukan *pre-flight check* (`03-verify-production.sql`) pada sistem PostgreSQL *Production* untuk memastikan kelengkapan 6 tabel utama fitur Push Mas Kurir.

## Proses Git Merge (Phase 9 & 10)
Setelah tahap 4 sukses (*Verify Production* PASS):
1. `git checkout main`
2. `git pull origin main`
3. `git merge ltms-mvp`
4. Lakukan resolve jika terjadi konflik, lalu `git push origin main`.
5. Pastikan Vercel mendeteksi push tersebut, lalu uji langsung *Push Mas Kurir* dari Dashboard *Production* menggunakan endpoint Bablast *webhook* aktual!
