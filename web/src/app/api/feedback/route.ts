import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { submitFeedback } from '@/lib/apps-script/longtail';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { waybill, feedback, baseVersion } = await request.json();
  try {
    const data = await submitFeedback(session.user.email, waybill, feedback, baseVersion);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
