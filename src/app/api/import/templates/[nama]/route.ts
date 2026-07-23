import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteMappingTemplate } from '@/lib/apps-script/import';
import { errorResponse, unauthenticated } from '@/lib/api-response';

type Params = { params: Promise<{ nama: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  const { nama } = await params;
  try {
    const data = await deleteMappingTemplate(session.user.email, decodeURIComponent(nama));
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
