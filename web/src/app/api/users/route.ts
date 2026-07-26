import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createUser, listUsers } from '@/lib/data/users';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const data = await listUsers(session.user.email);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const body = await request.json();
  try {
    const data = await createUser(session.user.email, body);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
