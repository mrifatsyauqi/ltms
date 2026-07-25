'use server';

import { AuthError } from 'next-auth';
import { signIn, signOut } from '@/auth';

/** Server action logout, dipakai form di sidebar (komponen client). */
export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}

/** Server action login manual (email + password), dipakai form di halaman login. */
export async function credentialsSignInAction(_prevState: string | undefined, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  try {
    await signIn('credentials', { email, password, redirectTo: '/' });
  } catch (err) {
    if (err instanceof AuthError) {
      return 'Email atau password salah.';
    }
    throw err; // biarkan redirect sukses (NEXT_REDIRECT) lewat tanpa ditangkap
  }
}
