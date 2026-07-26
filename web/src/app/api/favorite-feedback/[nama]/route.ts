import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { removeFavoriteFeedback } from '@/lib/data/favorite-feedback';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ nama: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { nama } = await params;
  try {
    const data = await removeFavoriteFeedback(session.user.email, decodeURIComponent(nama));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
