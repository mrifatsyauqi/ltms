import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { whatsappService } from '@/services/communication/whatsapp.service';
import { getActiveTemplate } from '@/lib/data/supabase/whatsapp';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { targets, threshold, operator } = body;
    
    if (!targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ ok: false, error: 'Target list is empty' }, { status: 400 });
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
      session.user.email || 'unknown'
    );

    return NextResponse.json({ ok: true, data: result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
