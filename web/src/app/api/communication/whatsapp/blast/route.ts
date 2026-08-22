import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { whatsappService } from '@/services/communication/whatsapp.service';
import { getActiveTemplate } from '@/lib/data/supabase/whatsapp';
import { unauthenticated, errorResponse } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json();
    const { targets, threshold, operator, sender_code } = body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ ok: false, error: 'Target list is empty' }, { status: 400 });
    }

    if (!sender_code) {
      return NextResponse.json({ ok: false, error: 'Sender code is required' }, { status: 400 });
    }

    const template = await getActiveTemplate();
    if (!template) {
      return NextResponse.json({ ok: false, error: 'No active template found' }, { status: 400 });
    }

    const result = await whatsappService.processBlast(
      targets,
      template,
      threshold,
      operator,
      session.user.email,
      sender_code
    );

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return errorResponse(error);
  }
}
