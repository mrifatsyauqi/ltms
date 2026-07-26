import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { previewArchive, runArchive } from '@/lib/data/archive';
import { errorResponse, unauthenticated } from '@/lib/api-response';

const THRESHOLD = 30; // hari (PRD Bagian 8)

// GET = preview (dry-run) berapa yang siap diarsipkan.
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await previewArchive(session.user.email, THRESHOLD);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

// POST = jalankan arsip beneran.
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await runArchive(session.user.email, THRESHOLD);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
