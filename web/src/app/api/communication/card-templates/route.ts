import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleParam = searchParams.get('module') || undefined;
    let statusParam = searchParams.get('status') || undefined;
    const includeArchived = searchParams.get('include_archived') === 'true';

    if (includeArchived || statusParam === 'all') {
      statusParam = undefined;
    }

    const templates = await cardTemplateService.listTemplates({
      module: moduleParam,
      status: (statusParam as any),
    });

    return NextResponse.json({ success: true, ok: true, data: templates });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal memuat card templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const template_name = body.template_name || body.name;
    const version_note = body.version_note || body.change_summary || body.description || 'Initial version';

    if (!template_name || !body.blocks_config || !body.module) {
      return NextResponse.json(
        { success: false, ok: false, error: 'template_name, blocks_config, dan module wajib diisi' },
        { status: 400 }
      );
    }

    const created = await cardTemplateService.createFromBlocks({
      module: body.module,
      template_name: template_name.trim(),
      blocks_config: body.blocks_config,
      is_default: Boolean(body.is_default),
      version_note: version_note.trim(),
    });

    return NextResponse.json({ success: true, ok: true, data: created });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal membuat card template' },
      { status: 500 }
    );
  }
}
