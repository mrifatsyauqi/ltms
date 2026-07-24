import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createMasterFeedback, listMasterFeedback } from '@/lib/apps-script/master-feedback';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const data = await listMasterFeedback(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { namaFeedback } = await request.json();
  try {
    const data = await createMasterFeedback(session.user.email, namaFeedback);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
