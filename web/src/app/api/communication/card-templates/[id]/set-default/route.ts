import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const ok = await cardTemplateService.setDefault(id);
    if (!ok) throw new ApiError('INTERNAL_ERROR', 'Gagal mengatur template default');
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err) {
    return errorResponse(err);
  }
}
