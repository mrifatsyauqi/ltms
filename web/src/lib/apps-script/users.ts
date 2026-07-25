import { callAppsScript } from './client';
import { verifyPassword } from '@/lib/password';

export type UserRow = {
  Nama: string;
  Email: string;
  Role: string;
  'Drop Point': string;
  'Status Aktif': string;
};

export type CreateUserInput = {
  nama: string;
  email: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint?: string;
};

export type UpdateUserInput = Partial<{
  nama: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint: string;
  statusAktif: boolean;
}>;

export function listUsers(actorEmail: string) {
  return callAppsScript<UserRow[]>('listUsers', { email: actorEmail });
}

export function createUser(actorEmail: string, data: CreateUserInput) {
  return callAppsScript<{ email: string }>('createUser', { email: actorEmail, data });
}

export function updateUser(actorEmail: string, targetEmail: string, data: UpdateUserInput) {
  return callAppsScript<UserRow>('updateUser', { email: actorEmail, targetEmail, data });
}

export function deleteUser(actorEmail: string, targetEmail: string) {
  return callAppsScript<{ email: string }>('deleteUser', { email: actorEmail, targetEmail });
}

export function setUserPassword(actorEmail: string, targetEmail: string, passwordHash: string) {
  return callAppsScript<{ email: string }>('setUserPassword', { email: actorEmail, targetEmail, passwordHash });
}

type PasswordHashResponse =
  | { found: true; passwordHash: string; nama: string; email: string; role: string; dropPoint: string; statusAktif: boolean }
  | { found: false };

/** Tidak butuh actor - dipanggil sebelum ada sesi (lihat getPasswordHash di Code.gs). */
function getPasswordHash(email: string) {
  return callAppsScript<PasswordHashResponse>('getPasswordHash', { email });
}

export type CredentialsUser = { nama: string; email: string; role: string; dropPoint: string };

/**
 * Verifikasi login manual (email + password) terhadap hash di sheet Users.
 * Null berarti tolak login: user tidak ada, nonaktif, belum punya password
 * ter-set, atau password salah.
 */
export async function verifyCredentials(email: string, plainPassword: string): Promise<CredentialsUser | null> {
  const result = await getPasswordHash(email.trim().toLowerCase());
  if (!result.found || !result.passwordHash || !result.statusAktif) return null;
  const valid = await verifyPassword(plainPassword, result.passwordHash);
  if (!valid) return null;
  return { nama: result.nama, email: result.email, role: result.role, dropPoint: result.dropPoint };
}
