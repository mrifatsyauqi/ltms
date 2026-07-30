import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createShareLink, getShareLinkStats } from '@/lib/data/supabase/public-share';
import { errorResponse, unauthenticated } from '@/lib/api-response';

// GET = statistik link aktif saat ini (null kalau belum ada/sudah dicabut total). Admin Cabang divalidasi di data layer.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await getShareLinkStats(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST = "Buat Link Laporan" - hanya kalau belum ada link aktif.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await createShareLink(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
