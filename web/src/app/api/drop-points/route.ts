import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createDropPoint, listDropPoints } from '@/lib/apps-script/drop-points';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const data = await listDropPoints(session.user.email);
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
    const data = await createDropPoint(session.user.email, body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
