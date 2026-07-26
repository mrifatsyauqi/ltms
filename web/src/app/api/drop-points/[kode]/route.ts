import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteDropPoint, updateDropPoint } from '@/lib/data/drop-points';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ kode: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { kode } = await params;
  const body = await request.json();
  try {
    const data = await updateDropPoint(session.user.email, decodeURIComponent(kode), body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { kode } = await params;
  try {
    const data = await deleteDropPoint(session.user.email, decodeURIComponent(kode));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
