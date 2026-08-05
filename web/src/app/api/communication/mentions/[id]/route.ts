import { NextRequest, NextResponse } from 'next/server';
import { mentionService } from '@/services/communication/configuration/mention.service';

/**
 * GET /api/communication/mentions/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const mapping = await mentionService.getById(id);

    if (!mapping) {
      return NextResponse.json(
        { success: false, error: 'Mention mapping tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: mapping });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memuat mention mapping' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/communication/mentions/[id]
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await mentionService.update(id, body);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Gagal memperbarui mention mapping' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal memperbarui mention mapping' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/communication/mentions/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ok = await mentionService.delete(id);

    return NextResponse.json({ success: ok });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Gagal menghapus mention mapping' },
      { status: 500 }
    );
  }
}
