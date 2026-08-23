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
    console.log('[WEBHOOK_RECEIVED] Raw body:', JSON.stringify(body, null, 2));

    const { event, blast_id, data } = body;
    console.log(`[WEBHOOK_PARSED] event=${event}, blast_id=${blast_id}, data=`, data);
    
    if (!data || !data.recipient) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook payload' }, { status: 400 });
    }

    const supabase = db();
    
    // 1. Temukan batch berdasarkan blast_id dari Bablast
    let batchIdToUpdate = null;
    if (blast_id) {
      const { data: batchData, error: batchError } = await supabase
        .from('whatsapp_send_batches')
        .select('id, blast_id')
        .eq('blast_id', Number(blast_id))
        .maybeSingle();
      if (batchError) console.error('[WEBHOOK_ERROR] Failed to fetch batch:', batchError);
      if (batchData) {
        batchIdToUpdate = batchData.id;
        console.log(`[WEBHOOK_MAPPING] Found batch.id=${batchIdToUpdate} for blast_id=${blast_id}`);
      } else {
        console.warn(`[WEBHOOK_MAPPING] No batch found for blast_id=${blast_id}`);
      }
    }

    // Normalisasi nomor telepon
    let normalizedRecipient = String(data.recipient || '').replace(/\D/g, ''); // remove non-digits
    let alternateRecipient = normalizedRecipient;
    
    // Jika data.recipient berawalan 62, alternatifnya berawalan 0
    if (normalizedRecipient.startsWith('62')) {
      alternateRecipient = '0' + normalizedRecipient.substring(2);
    } else if (normalizedRecipient.startsWith('0')) {
      alternateRecipient = '62' + normalizedRecipient.substring(1);
    }

    // 2. Jika tidak ada batchId (mungkin pesan satuan), fallback ke pencarian berdasarkan nomor HP terakhir
    let logQuery = supabase.from('whatsapp_send_logs').select('id, batch_id')
      .or(`phone_number.eq.${normalizedRecipient},phone_number.eq.${alternateRecipient}`);
      
    if (batchIdToUpdate) {
      logQuery = logQuery.eq('batch_id', batchIdToUpdate);
    }
    
    const { data: latestLog, error: fetchError } = await logQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !latestLog) {
      console.warn(`[WEBHOOK_MAPPING] No matching log found for phone=${data.recipient} and batch_id=${batchIdToUpdate}`);
      return NextResponse.json({ ok: true, note: 'No matching log found' });
    }
    console.log(`[WEBHOOK_MAPPING] Found log.id=${latestLog.id} for phone=${data.recipient}`);

    // Map Bablast status to LTMS status
    // Expected from Bablast: sent, failed, delivered, read
    let rawStatus = data.status ? data.status.toUpperCase() : 'SENT';
    let normalizedStatus = rawStatus;
    if (rawStatus === 'ERROR') normalizedStatus = 'FAILED';
    if (rawStatus === 'SUCCESS') normalizedStatus = 'SENT';
    if (rawStatus === 'PROGRESS') normalizedStatus = 'PROCESSING';
    if (rawStatus === 'PENDING') normalizedStatus = 'QUEUED';

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
