import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboard } from '@/lib/data/dashboard';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  // Filter CAKUPAN (Admin Cabang). Kosong = agregat semua DP seperti biasa.
  const dp = new URL(request.url).searchParams.get('dp') ?? undefined;

  try {
    const data = await getDashboard(session.user.email, dp);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
