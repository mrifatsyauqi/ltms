import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { listRoleAksesSummary } from '@/lib/data/role-akses';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const data = await listRoleAksesSummary(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
