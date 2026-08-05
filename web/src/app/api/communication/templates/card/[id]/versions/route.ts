import { NextRequest, NextResponse } from 'next/server';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const versions = await cardTemplateService.getVersions(id);
    return NextResponse.json({ success: true, ok: true, data: versions });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, ok: false, error: error.message || 'Gagal memuat riwayat versi' },
      { status: 500 }
    );
  }
}
