import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthenticated, errorResponse } from '@/lib/api-response';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { db } from '@/lib/data/supabase/client';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return unauthenticated();

  try {
    const body = await req.json().catch(() => ({}));
    const { phone, message, sender_code, sender_id } = body;

    if (!phone || !message || !sender_code) {
      return NextResponse.json({ ok: false, error: 'Phone, message, and sender_code are required' }, { status: 400 });
    }

    // Call bablast service
    const response = await bablastService.sendTestMessage({ phone, message, sender_code });
    
    // Attempt to log to history regardless of success/fail if we can
    const supabase = db();
    const batchId = crypto.randomUUID();
    
    try {
      await supabase.from('whatsapp_logs').insert({
        batch_id: batchId,
        sprinter_id: sender_id || sender_code, // Use sender identifier as sprinter_id placeholder for test
        phone_number: phone,
        rendered_message: message,
        bablast_message_id: response.data?.message_id || null,
        status: response.ok ? 'sent' : 'failed',
        error_message: response.ok ? null : response.error || 'Unknown error',
        sent_at: response.ok ? new Date().toISOString() : null
      });
    } catch (e) {
      console.error('Failed to write test send log:', e);
    }

    if (!response.ok) {
      // 404 is passed cleanly back so frontend can parse it
      return NextResponse.json(response, { status: response.status || 500 });
    }

    return NextResponse.json(response);
  } catch (error: any) {
    return errorResponse(error);
  }
}
