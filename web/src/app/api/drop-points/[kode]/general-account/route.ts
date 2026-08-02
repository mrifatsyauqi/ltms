import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createGeneralAccount } from '@/lib/data/users';
import { hashPassword } from '@/lib/password';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ kode: string }> };

/** Buat akun General (satu per Drop Point) — dipicu dari Master Drop Point. */
export async function POST(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { kode } = await params;
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
    const data = await createGeneralAccount(session.user.email, decodeURIComponent(kode), passwordHash);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
