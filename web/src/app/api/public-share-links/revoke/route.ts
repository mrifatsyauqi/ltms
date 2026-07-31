import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { revokeShareLink } from '@/lib/data/supabase/public-share';
import { errorResponse, unauthenticated } from '@/lib/api-response';

// POST = "Cabut Total" - revoke tanpa generate baru, mematikan fitur sampai dibuat ulang manual.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    await revokeShareLink(session.user.email);
    return NextResponse.json({ ok: true, data: null });
  } catch (err) {
    return errorResponse(err);
  }
}
