import { NextRequest, NextResponse } from 'next/server';
import { messageTemplateService } from '@/services/communication/configuration/message-template.service';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const versions = await messageTemplateService.getVersions(id);
    return NextResponse.json({ ok: true, data: versions });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
