import { db } from './client';
import { verifyPassword } from '@/lib/password';
import { isLoginLocked, recordLoginFailure, recordLoginSuccess } from './login-attempts';
import type { AuthUser } from '@/lib/data/types';
import type { CredentialsUser } from '@/lib/data/types';

const CREDENTIALS_COLUMNS = 'nama, nama_tampilan, email, nik, tipe_akun, role, drop_point, status_aktif, password_hash';

type CredentialsDbRow = {
  nama: string;
  nama_tampilan: string | null;
  email: string;
  nik: string | null;
  tipe_akun: string | null;
  role: string;
  drop_point: string | null;
  status_aktif: boolean;
  password_hash: string | null;
};

function toCredentialsUser(r: CredentialsDbRow): CredentialsUser {
  return {
    nama: String(r.nama ?? ''),
    namaTampilan: String(r.nama_tampilan ?? r.nama ?? ''),
    email: String(r.email ?? ''),
    nik: String(r.nik ?? ''),
    tipeAkun: r.tipe_akun === 'general' ? 'general' : 'individual',
    role: String(r.role ?? ''),
    dropPoint: String(r.drop_point ?? ''),
  };
}

/**
 * Cari baris user by NIK dulu (exact match, sesuai yg tersimpan), fallback
 * by email (lowercase) kalau tak ketemu — supaya SATU form login bisa
 * menerima baik NIK (user baru, migrasi auth) maupun email (user lama, login
 * manual yang sudah ada sebelumnya). Google OAuth TIDAK lewat sini (tetap
 * getUserByEmail, tidak berubah).
 */
async function findUserRowByIdentifier(identifier: string): Promise<CredentialsDbRow | null> {
  const id = String(identifier ?? '').trim();
  if (!id) return null;

  const byNik = await db().from('users').select(CREDENTIALS_COLUMNS).eq('nik', id).maybeSingle();
  if (byNik.error) throw new Error(`Supabase findUserRowByIdentifier (nik): ${byNik.error.message}`);
  if (byNik.data) return byNik.data as CredentialsDbRow;

  const byEmail = await db().from('users').select(CREDENTIALS_COLUMNS).eq('email', id.toLowerCase()).maybeSingle();
  if (byEmail.error) throw new Error(`Supabase findUserRowByIdentifier (email): ${byEmail.error.message}`);
  return (byEmail.data as CredentialsDbRow) ?? null;
}

/**
 * Resolusi role + Drop Point dari tabel users (pengganti getUserByEmail Apps
 * Script). Null = tolak login: tidak ada / nonaktif. Error DB dilempar supaya
 * salah konfigurasi terlihat (bukan diam-diam menolak semua login).
 */
export async function getUserByEmail(email: string): Promise<AuthUser | null> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  const { data, error } = await db()
    .from('users')
    .select('nama, email, role, drop_point, status_aktif')
    .eq('email', e)
    .maybeSingle();
  if (error) throw new Error(`Supabase getUserByEmail: ${error.message}`);
  if (!data || data.status_aktif !== true) return null;
  return {
    nama: String(data.nama ?? ''),
    email: String(data.email ?? ''),
    role: String(data.role ?? ''),
    dropPoint: String(data.drop_point ?? ''),
    statusAktif: true,
  };
}

/**
 * Verifikasi login manual (NIK ATAU email + password) terhadap password_hash
 * di users. Ini SATU-SATUNYA tempat password_hash dibaca. Null = tolak
 * (identifier terkunci rate-limit, tidak ada, nonaktif, belum set password,
 * atau password salah) — dibedakan lewat isLoginLocked() di sisi pemanggil
 * kalau perlu pesan berbeda, TAPI di sini semua kegagalan pulang null yang
 * sama supaya tidak membocorkan identifier mana yg valid (anti-enumerasi).
 *
 * Rate limiting (5x gagal berturut/15 menit -> kunci 15 menit) ditegakkan DI
 * SINI (bukan cuma di caller) supaya berlaku juga kalau fungsi ini dipanggil
 * dari jalur lain di masa depan.
 */
export async function verifyCredentials(identifier: string, plainPassword: string): Promise<CredentialsUser | null> {
  const id = String(identifier ?? '').trim();
  if (!id || !plainPassword) return null;

  if (await isLoginLocked(id)) return null;

  const data = await findUserRowByIdentifier(id);
  if (!data || !data.password_hash || data.status_aktif !== true) {
    await recordLoginFailure(id);
    return null;
  }
  const valid = await verifyPassword(plainPassword, String(data.password_hash));
  if (!valid) {
    await recordLoginFailure(id);
    return null;
  }
  await recordLoginSuccess(id);
  return toCredentialsUser(data);
}
