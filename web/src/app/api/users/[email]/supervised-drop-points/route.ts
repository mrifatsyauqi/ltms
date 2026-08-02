import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { syncSupervisedDropPoints } from '@/lib/data/drop-points';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ email: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { email: targetEmail } = await params;
  const body = await request.json();
  const kodeDpList = Array.isArray(body?.kodeDpList) ? body.kodeDpList : [];

  try {
    const data = await syncSupervisedDropPoints(session.user.email, decodeURIComponent(targetEmail), kodeDpList);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
