import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const duplicated = await cardTemplateService.duplicate(id);
    return NextResponse.json({ success: true, ok: true, data: duplicated });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal menduplikasi template' },
      { status: 500 }
    );
  }
}
