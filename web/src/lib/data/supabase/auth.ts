import { db } from './client';
import { verifyPassword } from '@/lib/password';
import type { AuthUser } from '@/lib/data/types';
import type { CredentialsUser } from '@/lib/data/types';

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
 * Verifikasi login manual (email + password) terhadap password_hash di users.
 * Ini SATU-SATUNYA tempat password_hash dibaca. Null = tolak (tidak ada,
 * nonaktif, belum set password, atau password salah).
 */
export async function verifyCredentials(email: string, plainPassword: string): Promise<CredentialsUser | null> {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  const { data, error } = await db()
    .from('users')
    .select('nama, email, role, drop_point, status_aktif, password_hash')
    .eq('email', e)
    .maybeSingle();
  if (error) throw new Error(`Supabase verifyCredentials: ${error.message}`);
  if (!data || !data.password_hash || data.status_aktif !== true) return null;
  const valid = await verifyPassword(plainPassword, String(data.password_hash));
  if (!valid) return null;
  return {
    nama: String(data.nama ?? ''),
    email: String(data.email ?? ''),
    role: String(data.role ?? ''),
    dropPoint: String(data.drop_point ?? ''),
  };
}
