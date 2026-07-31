import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { regenerateShareLink } from '@/lib/data/supabase/public-share';
import { errorResponse, unauthenticated } from '@/lib/api-response';

// POST = "Regenerate Link" - revoke link lama seketika + buat token baru sekaligus.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await regenerateShareLink(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
