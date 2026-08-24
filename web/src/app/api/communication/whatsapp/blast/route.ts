import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { whatsappService } from '@/services/communication/whatsapp.service';
import { getActiveTemplate } from '@/lib/data/supabase/whatsapp';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { db } from '@/lib/data/supabase/client';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json();
    const { targets, threshold, operator, sender_code, delay_seconds } = body;
    
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

    // DELAY VALIDATION
    const allowedDelays = [0, 5, 10, 15, 30, 60];
    const delaySeconds = delay_seconds !== undefined ? Number(delay_seconds) : 10;
    
    if (!allowedDelays.includes(delaySeconds)) {
      return NextResponse.json({ ok: false, error: 'Jeda pengiriman tidak valid.' }, { status: 400 });
    }

    // TIMEOUT PROTECTION IS REMOVED (Handled by Bablast)

    // MULTI DROP POINT SENDER ISOLATION VALIDATION
    const supabase = db();
    const { data: sender, error: senderError } = await supabase
      .from('whatsapp_sender_connections')
      .select('drop_point_id, sender_code')
      .eq('sender_code', sender_code)
      .maybeSingle();

    if (senderError || !sender) {
      return NextResponse.json({ ok: false, error: 'WhatsApp Sender tidak ditemukan' }, { status: 404 });
    }

    const isSuperAdmin = (session.user as any).role === 'Super Admin';
    const userDp = (session.user as any).dropPoint;

    if (!isSuperAdmin && sender.drop_point_id !== userDp) {
      return NextResponse.json({ ok: false, error: 'WhatsApp Sender untuk Drop Point ini tidak ditemukan.' }, { status: 403 });
    }

    const result = await whatsappService.processBlast(
      targets,
      template,
      threshold,
      operator,
      session.user.email,
      sender_code,
      delaySeconds,
      userDp
    );

    return NextResponse.json({ 
      ok: true, 
      success: true,
      batch_id: result.batchId,
      status: result.status,
      total_messages: result.totalMessages
    });
  } catch (error: any) {
    return errorResponse(error);
  }
}
