import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/** Navigasi utama kini lewat sidebar, jadi root langsung ke Dashboard. */
export default async function RootPage() {
  const session = await auth();
  redirect(session ? '/dashboard' : '/login');
}
