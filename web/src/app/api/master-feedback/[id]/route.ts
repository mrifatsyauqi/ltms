import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteMasterFeedback, updateMasterFeedback } from '@/lib/apps-script/master-feedback';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { id } = await params;
  const body = await request.json();
  try {
    const data = await updateMasterFeedback(session.user.email, id, body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { id } = await params;
  try {
    const data = await deleteMasterFeedback(session.user.email, id);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
