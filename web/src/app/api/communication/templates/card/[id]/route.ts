import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await cardTemplateService.getById(id);
    if (!template) {
      return NextResponse.json(
        { success: false, ok: false, error: 'Card template tidak ditemukan' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, ok: true, data: template });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const template_name = body.template_name || body.name;
    const version_note = body.version_note || body.change_summary || body.description;

    const updated = await cardTemplateService.updateFromBlocks(id, {
      template_name: template_name ? template_name.trim() : undefined,
      blocks_config: body.blocks_config,
      is_default: body.is_default !== undefined ? Boolean(body.is_default) : undefined,
      version_note: version_note ? version_note.trim() : undefined,
    });

    return NextResponse.json({ success: true, ok: true, data: updated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await cardTemplateService.archive(id);
    return NextResponse.json({ success, ok: success });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message },
      { status: 500 }
    );
  }
}
