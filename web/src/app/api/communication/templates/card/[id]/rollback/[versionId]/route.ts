import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const ok = await cardTemplateService.rollback(id, versionId);
    return NextResponse.json({ success: ok, ok });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal rollback versi template' },
      { status: 500 }
    );
  }
}
