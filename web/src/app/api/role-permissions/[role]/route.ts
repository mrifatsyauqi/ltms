import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getRoleDefaultPermissions, setRoleDefaultPermission } from '@/lib/data/role-akses';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ role: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { role } = await params;
  try {
    const data = await getRoleDefaultPermissions(session.user.email, decodeURIComponent(role));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { role } = await params;
  const body = await request.json();
  try {
    const data = await setRoleDefaultPermission(
      session.user.email,
      decodeURIComponent(role),
      String(body?.menuKey ?? ''),
      Boolean(body?.enabled),
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
