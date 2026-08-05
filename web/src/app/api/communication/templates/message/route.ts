import { NextRequest, NextResponse } from 'next/server';
import { messageTemplateService } from '@/services/communication/configuration/message-template.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moduleParam = searchParams.get('module') || undefined;
    const statusParam = (searchParams.get('status') as any) || undefined;

    const templates = await messageTemplateService.listTemplates({
      module: moduleParam,
      status: statusParam,
    });

    return NextResponse.json({ ok: true, data: templates });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memuat message templates' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.template_name || !body.content || !body.module) {
      return NextResponse.json(
        { ok: false, error: 'template_name, content, dan module wajib diisi' },
        { status: 400 }
      );
    }

    const created = await messageTemplateService.create({
      module: body.module,
      template_name: body.template_name,
      content: body.content,
      is_default: Boolean(body.is_default),
      version_note: body.version_note || 'Initial version',
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal membuat message template' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: 'ID template wajib disertakan' },
        { status: 400 }
      );
    }

    const updated = await messageTemplateService.update(body.id, {
      template_name: body.template_name,
      content: body.content,
      is_default: body.is_default,
      version_note: body.version_note,
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal memperbarui message template' },
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
        { ok: false, error: 'ID template wajib disertakan' },
        { status: 400 }
      );
    }

    const success = await messageTemplateService.archive(id);
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal mengarsipkan template' },
      { status: 500 }
    );
  }
}
