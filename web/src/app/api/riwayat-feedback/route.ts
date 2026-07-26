import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listRiwayatFeedback } from '@/lib/data/riwayat-feedback';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from') ?? undefined;
  const to = searchParams.get('to') ?? undefined;

  try {
    const data = await listRiwayatFeedback(session.user.email, from, to);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
