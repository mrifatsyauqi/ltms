import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { cardTemplateService } from '@/services/communication/configuration/card-template.service';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const { id } = await params;
    const versions = await cardTemplateService.getVersions(id);
    return NextResponse.json({ ok: true, data: versions });
  } catch (err) {
    return errorResponse(err);
  }
}
