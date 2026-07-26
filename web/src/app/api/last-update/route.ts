import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLastUpdate } from '@/lib/data/meta';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();
  try {
    const data = await getLastUpdate(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
