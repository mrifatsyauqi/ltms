import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createLongTail, listLongTail } from '@/lib/data/longtail';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { searchParams } = new URL(request.url);
  const dpFilter = searchParams.get('dp') || undefined;

  try {
    const data = await listLongTail(session.user.email, dpFilter);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const body = await request.json();
  try {
    const data = await createLongTail(session.user.email, body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
