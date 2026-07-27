import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { previewResetLongTail, resetLongTailData } from '@/lib/data/longtail';
import { errorResponse, unauthenticated } from '@/lib/api-response';

// GET = preview (dry-run) berapa baris data transaksi yang akan dihapus.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await previewResetLongTail(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST = jalankan reset beneran (Admin Cabang divalidasi di Apps Script).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const body = await request.json().catch(() => ({}));
    const targets = Array.isArray(body.targets) ? body.targets : undefined;
    const data = await resetLongTailData(session.user.email, targets);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
