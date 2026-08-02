'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';
import { isLoginLocked } from '@/lib/data/supabase/login-attempts';

/** Server action logout, dipakai form di sidebar (komponen client). */
export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

/**
 * Server action login manual (NIK ATAU email + password), dipakai form di
 * halaman login. Cek lock rate-limit DULU (query langsung, bukan lewat pesan
 * error NextAuth yang rapuh di beta) supaya user yang terkunci dapat pesan
 * spesifik, bukan disamakan dgn "password salah" — penegakan sesungguhnya
 * tetap di dalam verifyCredentials() (lihat lib/data/supabase/auth.ts),
 * pengecekan di sini murni utk pesan yg lebih jelas.
 */
export async function credentialsSignInAction(_prevState: string | undefined, formData: FormData) {
  const identifier = String(formData.get('identifier') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (identifier && (await isLoginLocked(identifier))) {
    return 'Terlalu banyak percobaan gagal. Akun ini dikunci sementara — coba lagi dalam beberapa menit.';
  }

  try {
    await signIn('credentials', { identifier, password, redirectTo: '/' });
  } catch (err) {
    if (err instanceof AuthError) {
      return 'NIK/Email atau password salah.';
    }
    throw err; // biarkan redirect sukses (NEXT_REDIRECT) lewat tanpa ditangkap
  }
}
