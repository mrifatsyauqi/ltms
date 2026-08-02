import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listAccountsByRole } from '@/lib/data/role-akses';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ role: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { role } = await params;
  try {
    const data = await listAccountsByRole(session.user.email, decodeURIComponent(role));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
