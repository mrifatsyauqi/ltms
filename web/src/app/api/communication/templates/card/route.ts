import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleParam = searchParams.get('module') || undefined;
    const statusParam = (searchParams.get('status') as any) || undefined;

    const templates = await cardTemplateService.listTemplates({
      module: moduleParam,
      status: statusParam,
    });

    return NextResponse.json({ ok: true, data: templates });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memuat card templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.template_name || !body.blocks_config || !body.module) {
      return NextResponse.json(
        { ok: false, error: 'template_name, blocks_config, dan module wajib diisi' },
        { status: 400 }
      );
    }

    const created = await cardTemplateService.createFromBlocks({
      module: body.module,
      template_name: body.template_name,
      blocks_config: body.blocks_config,
      is_default: Boolean(body.is_default),
      version_note: body.version_note || 'Initial version',
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal membuat card template' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: 'ID card template wajib disertakan' },
        { status: 400 }
      );
    }

    const updated = await cardTemplateService.updateFromBlocks(body.id, {
      template_name: body.template_name,
      blocks_config: body.blocks_config,
      is_default: body.is_default,
      version_note: body.version_note,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memperbarui card template' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'ID card template wajib disertakan' },
        { status: 400 }
      );
    }

    const success = await cardTemplateService.archive(id);
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal mengarsipkan card template' },
      { status: 500 }
    );
  }
}
