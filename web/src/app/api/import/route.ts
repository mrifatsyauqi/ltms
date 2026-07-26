import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { importLongTail } from '@/lib/data/import';
import { errorResponse, unauthenticated } from '@/lib/api-response';

/** Satu request = satu file (PRD Bagian 7.3 partial failure — file lain tetap lanjut walau ini gagal). */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { fileName, rows } = await request.json();
  try {
    const data = await importLongTail(session.user.email, fileName, rows);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
