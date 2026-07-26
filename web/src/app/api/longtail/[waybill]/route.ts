import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteLongTail, getLongTail, updateLongTail } from '@/lib/data/longtail';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ waybill: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { waybill } = await params;
  try {
    const data = await getLongTail(session.user.email, decodeURIComponent(waybill));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { waybill } = await params;
  const body = await request.json();
  try {
    const data = await updateLongTail(session.user.email, decodeURIComponent(waybill), body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { waybill } = await params;
  try {
    const data = await deleteLongTail(session.user.email, decodeURIComponent(waybill));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
