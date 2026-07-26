import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboard, getDashboardSnapshot } from '@/lib/data/dashboard';
import { jakartaTodayIso } from '@/lib/data/supabase/longtail-pure';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { searchParams } = new URL(request.url);
  // Filter CAKUPAN (Admin Cabang). Kosong = agregat semua DP seperti biasa.
  const dp = searchParams.get('dp') ?? undefined;
  // Tanggal "as-of" (v1.3). Bila diisi & sebelum hari ini -> baca snapshot historis.
  const date = searchParams.get('date') ?? undefined;

  try {
    if (date && date < jakartaTodayIso()) {
      const data = await getDashboardSnapshot(session.user.email, date, dp);
      // data === null -> snapshot tanggal itu belum ada (UI tampilkan empty state).
      return NextResponse.json({ ok: true, data, snapshot: true, date });
    }
    const data = await getDashboard(session.user.email, dp);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
