'use server';

import { signOut } from '@/auth';

/** Server action logout, dipakai form di sidebar (komponen client). */
export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
