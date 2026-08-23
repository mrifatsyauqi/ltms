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
    
    // 1. Temukan batch berdasarkan blast_id dari Bablast
    let batchIdToUpdate = null;
    if (blast_id) {
      const { data: batchData } = await supabase
        .from('whatsapp_send_batches')
        .select('id')
        .eq('blast_id', blast_id)
        .maybeSingle();
      if (batchData) {
        batchIdToUpdate = batchData.id;
      }
    }

    // 2. Jika tidak ada batchId (mungkin pesan satuan), fallback ke pencarian berdasarkan nomor HP terakhir
    let logQuery = supabase.from('whatsapp_send_logs').select('id, batch_id').eq('phone_number', data.recipient);
    if (batchIdToUpdate) {
      logQuery = logQuery.eq('batch_id', batchIdToUpdate);
    }
    
    const { data: latestLog, error: fetchError } = await logQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestLog) {
      return NextResponse.json({ ok: true, note: 'No matching log found' });
    }

    // Map Bablast status to LTMS status
    // Expected from Bablast: sent, failed, delivered, read
    const normalizedStatus = data.status ? data.status.toUpperCase() : 'SENT'; // e.g., SENT, FAILED

    const { error: updateError } = await supabase
      .from('whatsapp_send_logs')
      .update({
        status: normalizedStatus,
        bablast_message_id: data.message_id,
        error_message: data.error,
        updated_at: new Date().toISOString(),
        ...(data.status === 'sent' || data.status === 'SENT' ? { sent_at: data.timestamp || new Date().toISOString() } : {}),
        ...(data.status === 'delivered' || data.status === 'DELIVERED' ? { delivered_at: data.timestamp || new Date().toISOString() } : {}),
        ...(data.status === 'read' || data.status === 'READ' ? { read_at: data.timestamp || new Date().toISOString() } : {})
      })
      .eq('id', latestLog.id);

    // After updating log, we should recalculate the batch progress
    if (latestLog.batch_id && (normalizedStatus === 'SENT' || normalizedStatus === 'FAILED' || normalizedStatus === 'DELIVERED' || normalizedStatus === 'READ')) {
      const { data: logsData } = await supabase
        .from('whatsapp_send_logs')
        .select('status')
        .eq('batch_id', latestLog.batch_id);
      
      if (logsData) {
        let successCount = 0;
        let failedCount = 0;
        let processedCount = 0;

        logsData.forEach((l: any) => {
          if (['SENT', 'DELIVERED', 'READ'].includes(l.status)) successCount++;
          if (l.status === 'FAILED') failedCount++;
          if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(l.status)) processedCount++;
        });

        const newStatus = processedCount >= logsData.length ? 'COMPLETED' : 
                          (failedCount > 0 ? 'PARTIAL' : 'PROCESSING');
        
        await supabase
          .from('whatsapp_send_batches')
          .update({
            success_count: successCount,
            failed_count: failedCount,
            status: newStatus,
            ...(newStatus === 'COMPLETED' ? { completed_at: new Date().toISOString() } : {})
          })
          .eq('id', latestLog.batch_id);
      }
    }

    if (updateError) {
      console.error('Failed to update webhook log:', updateError);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
