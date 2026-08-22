import { NextResponse } from 'next/server';
import { db } from '@/lib/data/supabase/client';

export async function POST(request: Request) {
  try {
    const secret = process.env.BABLAST_WEBHOOK_SECRET;
    const authHeader = request.headers.get('Authorization');
    
    // Validate if secret is configured
    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook signature or token' }, { status: 401 });
    }
    
    const body = await request.json();
    const { event, blast_id, data } = body;
    
    if (!data || !data.recipient) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook payload' }, { status: 400 });
    }

    const supabase = db();
    
    // We update the log entry that matches the recipient phone number.
    const { data: latestLog, error: fetchError } = await supabase
      .from('whatsapp_send_logs')
      .select('id')
      .eq('phone_number', data.recipient)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestLog) {
      return NextResponse.json({ ok: true, note: 'No matching log found' });
    }

    const { error: updateError } = await supabase
      .from('whatsapp_send_logs')
      .update({
        status: data.status,
        bablast_message_id: data.message_id,
        error_message: data.error,
        updated_at: new Date().toISOString(),
        ...(data.status === 'sent' ? { sent_at: data.timestamp || new Date().toISOString() } : {}),
        ...(data.status === 'delivered' ? { delivered_at: data.timestamp || new Date().toISOString() } : {}),
        ...(data.status === 'read' ? { read_at: data.timestamp || new Date().toISOString() } : {})
      })
      .eq('id', latestLog.id);

    if (updateError) {
      console.error('Failed to update webhook log:', updateError);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
