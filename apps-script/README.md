# Deploy Apps Script backend (Fase 1)

Langkah ini dilakukan manual sekali oleh Admin Cabang / engineer (Claude Code
tidak bisa login Google, jadi langkah ini tidak bisa diotomatisasi dari sini).

> **Catatan keputusan proyek:** proyek ini tidak memakai domain Google
> Workspace (menggantikan PRD Bagian 4/5) — login menerima akun Google apa pun
> (termasuk Gmail pribadi). Kontrol akses satu-satunya adalah whitelist email
> di sheet `Users` di bawah: hanya email yang terdaftar dengan
> `Status Aktif = Aktif` yang bisa masuk. **Admin Cabang wajib menambahkan
> setiap email user baru ke sheet ini sebelum orang itu bisa login.**

## 1. Buat project Apps Script

1. Buka https://script.google.com → **New project**.
2. Ganti nama project menjadi `LTMS Backend`.
3. Hapus isi default `Code.gs`, lalu copy-paste isi file [`Code.gs`](./Code.gs)
   di folder ini.
4. Klik `+` di samping "Files" → `Script` → beri nama `Setup`, lalu copy-paste
   isi file [`Setup.gs`](./Setup.gs).

## 2. Jalankan setup sheet sekali

1. Di toolbar atas, pilih fungsi `setupSheets` dari dropdown (bukan `doGet`).
2. Klik **Run**. Saat diminta otorisasi, izinkan akses ke Google Sheets akun
   Anda.
3. Buka **View → Logs** (atau `Ctrl+Enter`), catat `Spreadsheet ID` dan URL
   yang muncul di log. Spreadsheet baru bernama
   **"LTMS - LongTail Dashboard Management System"** akan muncul di Google
   Drive Anda dengan 8 sheet:
   `Users`, `LongTail`, `LongTail_Archive` (hidden), `Master Feedback`,
   `Favorite Feedback`, `Import Batch`, `Activity_Log` (hidden),
   `Master Drop Point`.
4. Isi sheet `Users` minimal dengan akun Anda sendiri, contoh:

   | Nama | Email | Role | Drop Point | Status Aktif |
   |---|---|---|---|---|
   | Nama Anda | email.anda@gmail.com | Admin Cabang | (kosong) | Aktif |

   Role harus persis `Admin Cabang` atau `Admin DP` (dipakai apa adanya oleh
   frontend untuk keputusan hak akses).

## 3. Set Script Properties (secret & spreadsheet ID)

1. Di editor Apps Script: **Project Settings** (ikon gerigi) → **Script
   Properties** → **Add script property**.
2. Tambahkan:
   - `SHARED_SECRET` → string acak panjang (mis. hasil dari
     `openssl rand -hex 32`). Ini akan dipakai backend Next.js untuk
     mengautentikasi panggilan ke Web App ini — **jangan sampai bocor ke
     client-side**.
   - `SPREADSHEET_ID` → seharusnya sudah otomatis terisi oleh `setupSheets()`.
     Cek nilainya sama dengan Spreadsheet ID dari langkah 2.

## 4. Deploy sebagai Web App

1. Klik **Deploy → New deployment**.
2. Pilih tipe **Web app**.
3. **Execute as**: `Me` (akun Anda).
4. **Who has access**: `Anyone` (endpoint tetap dilindungi oleh
   `SHARED_SECRET` di Code.gs — jangan pilih "Anyone" tanpa secret di
   production tanpa memahami risikonya).
5. Klik **Deploy**, copy **Web app URL** yang diberikan (bentuknya
   `https://script.google.com/macros/s/XXXXX/exec`).

## 5. Isi environment variable Next.js

Masukkan ke `web/.env.local` (lihat `web/.env.local.example`):

```
APPS_SCRIPT_URL=https://script.google.com/macros/s/XXXXX/exec
APPS_SCRIPT_SHARED_SECRET=<nilai SHARED_SECRET yang sama seperti di atas>
```

## Catatan untuk Fase 2

`Code.gs` saat ini **hanya** berisi endpoint `getUserByEmail` (dipakai NextAuth
untuk resolve role saat login). Endpoint CRUD penuh untuk `LongTail`,
`Master Feedback`, `Favorite Feedback`, `Users`, dan `Master Drop Point`
(termasuk `LockService` untuk operasi tulis) akan ditambahkan di file yang
sama pada Fase 2 — redeploy ulang (**Deploy → Manage deployments → Edit →
New version**) diperlukan setiap kali kode `Code.gs` berubah.
