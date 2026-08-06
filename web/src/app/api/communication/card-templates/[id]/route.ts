import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const tpl = await cardTemplateService.getById(id);
    if (!tpl) throw new ApiError('NOT_FOUND', 'Card template tidak ditemukan');
    return NextResponse.json({ ok: true, data: tpl });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await cardTemplateService.updateFromBlocks(id, {
      template_name: body.name,
      blocks_config: body.blocks_config,
      is_default: body.is_default,
      version_note: body.change_summary || body.version_note,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Hapus permanen - bukan soft-archive. card_template_versions ikut terhapus
 *  (ON DELETE CASCADE); communication_logs tidak terpengaruh (card_json
 *  snapshot sendiri, tidak ada foreign key ke card_templates). */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const ok = await cardTemplateService.deletePermanently(id);
    if (!ok) throw new ApiError('INTERNAL_ERROR', 'Gagal menghapus card template');
    return NextResponse.json({ ok: true, data: { id } });
  } catch (err) {
    return errorResponse(err);
  }
}
