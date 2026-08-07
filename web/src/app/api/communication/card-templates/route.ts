import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { ApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { searchParams } = new URL(req.url);
    const moduleParam = searchParams.get('module') || undefined;
    // Kompat: dukung baik ?status=active|archived (lama) maupun
    // ?include_archived=true (dipakai halaman Card Templates - list gabungan
    // aktif+arsip utk toggle filter status di client tanpa refetch).
    const statusParam = (searchParams.get('status') as 'active' | 'archived' | null) || undefined;
    const includeArchived = searchParams.get('include_archived') === 'true';

    const templates = await cardTemplateService.listTemplates({
      module: moduleParam,
      status: includeArchived ? undefined : statusParam,
    });

    return NextResponse.json({ ok: true, data: templates });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json();
    if (!body.name?.trim() || !body.blocks_config || !body.module) {
      throw new ApiError('VALIDATION_ERROR', 'name, blocks_config, dan module wajib diisi');
    }

    const created = await cardTemplateService.createFromBlocks({
      module: body.module,
      template_name: body.name,
      blocks_config: body.blocks_config,
      is_default: Boolean(body.is_default),
      version_note: body.change_summary || body.version_note || 'Initial version',
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (err) {
    return errorResponse(err);
  }
}
