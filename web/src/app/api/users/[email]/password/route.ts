import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { setUserPassword } from '@/lib/apps-script/users';
import { hashPassword } from '@/lib/password';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ email: string }> };

export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { email: targetEmail } = await params;
  const body = await request.json();
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    return NextResponse.json(
      { ok: false, error: 'VALIDATION_ERROR', message: 'Password minimal 8 karakter' },
      { status: 422 },
    );
  }

  try {
    const passwordHash = await hashPassword(password);
    const data = await setUserPassword(session.user.email, decodeURIComponent(targetEmail), passwordHash);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
