import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { updateUser } from '@/lib/apps-script/users';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ email: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { email: targetEmail } = await params;
  const body = await request.json();
  try {
    const data = await updateUser(session.user.email, decodeURIComponent(targetEmail), body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
