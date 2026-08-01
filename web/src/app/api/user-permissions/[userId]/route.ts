import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAccountPermissions, resetUserPermissionOverride, setUserPermissionOverride } from '@/lib/data/role-akses';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { userId } = await params;
  try {
    const data = await getAccountPermissions(session.user.email, decodeURIComponent(userId));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { userId } = await params;
  const body = await request.json();
  try {
    const data = await setUserPermissionOverride(
      session.user.email,
      decodeURIComponent(userId),
      String(body?.menuKey ?? ''),
      Boolean(body?.enabled),
    );
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const menuKey = searchParams.get('menuKey') ?? '';
  try {
    const data = await resetUserPermissionOverride(session.user.email, decodeURIComponent(userId), menuKey);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
