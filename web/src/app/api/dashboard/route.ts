import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDashboard } from '@/lib/apps-script/dashboard';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const data = await getDashboard(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
