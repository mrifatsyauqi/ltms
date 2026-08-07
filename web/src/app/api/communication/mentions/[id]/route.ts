import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { mentionService } from '@/services/communication/configuration/mention.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

/**
 * GET /api/communication/mentions/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const mapping = await mentionService.getById(id);
    if (!mapping) throw new ApiError('NOT_FOUND', 'Mention mapping tidak ditemukan');
    return NextResponse.json({ ok: true, data: mapping });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PUT /api/communication/mentions/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await mentionService.update(id, body);
    if (!updated) throw new ApiError('INTERNAL_ERROR', 'Gagal memperbarui mention mapping');

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * DELETE /api/communication/mentions/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const ok = await mentionService.delete(id);
    return NextResponse.json({ ok, data: { id } });
  } catch (err) {
    return errorResponse(err);
  }
}
