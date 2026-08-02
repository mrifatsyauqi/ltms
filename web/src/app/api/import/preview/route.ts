import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { previewImport } from '@/lib/data/import';
import { errorResponse, unauthenticated } from '@/lib/api-response';

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { fileName, rows } = await request.json();
  try {
    const data = await previewImport(session.user.email, fileName, rows);
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
