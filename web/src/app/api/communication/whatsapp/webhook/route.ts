import { NextResponse } from 'next/server';
import { db } from '@/lib/data/supabase/client';

export async function POST(request: Request) {
  try {
    const rawSecret = process.env.BABLAST_WEBHOOK_SECRET;
    const secret = rawSecret ? rawSecret.trim() : '';
    const incomingSecret = request.headers.get('X-Webhook-Secret') || '';
    
    // Diagnostic log AMAN sesuai instruksi
    console.log(`[WEBHOOK_AUTH_MODE] mode=${secret ? 'SECRET' : 'DISABLED'}, header_present=${!!incomingSecret}, env_present=${!!secret}`);
    
    // Validate if secret is configured (MODE A vs MODE B)
    if (secret) {
      if (incomingSecret !== secret) {
        console.warn(`[WEBHOOK_AUTH_FAILED] Secret mismatch!`);
        return NextResponse.json({ ok: false, error: 'Invalid webhook secret' }, { status: 401 });
      }
    }
    
    const body = await request.json();
    const { event, blast_id, data } = body;
    
    // Diagnostic log AMAN: mencetak seluruh payload kecuali secret
    console.log(`[WEBHOOK_RECEIVED] RAW PAYLOAD:`, JSON.stringify(body));
    
    if (!data || !data.recipient) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook payload' }, { status: 400 });
    }

    const supabase = db();
    
    // 1. Temukan batch berdasarkan blast_id dari Bablast
    let batchIdToUpdate = null;
    if (blast_id) {
      // payload aktual dari bablast menunjukkan blast_id adalah integer, bukan string "blast_xxx"
      // tapi kita tetap handle jika sewaktu-waktu jadi string
      const incomingBlastId = String(blast_id).trim();
      const normalizedBlastId = incomingBlastId.replace(/^blast_/i, "");
      
      const { data: batchData, error: batchError } = await supabase
        .from('whatsapp_send_batches')
        .select('id, blast_id')
        .eq('blast_id', Number(normalizedBlastId))
        .maybeSingle();
        
      if (batchError) console.error('[WEBHOOK_ERROR] Failed to fetch batch:', batchError);
      
      if (batchData) {
        batchIdToUpdate = batchData.id;
        console.log(`[WEBHOOK_MAPPING] Found batch.id=${batchIdToUpdate} for blast_id=${blast_id}`);
      } else {
        console.warn(`[WEBHOOK_BATCH_NOT_FOUND] event=${event}, blast_id=${blast_id}, recipient=${data.recipient}`);
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

    // 2. Cari log berdasarkan batchId dan/atau nomor HP
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
      console.warn(`[WEBHOOK_LOG_NOT_FOUND] batch_id=${batchIdToUpdate}, recipient=${data.recipient}`);
      return NextResponse.json({ ok: true, note: 'No matching log found' });
    }

    // 3. Map Bablast status to LTMS status
    // Berdasarkan payload aktual: event = "message_sent" ("dikirim"), "message_delivered" ("terkirim")
    let normalizedStatus = 'QUEUED';
    const rawStatus = data.status ? String(data.status).toLowerCase() : '';
    
    // Gunakan prioritas: event name > status text
    if (event === 'message_delivered' || rawStatus === 'terkirim') {
      normalizedStatus = 'DELIVERED';
    } else if (event === 'message_sent' || rawStatus === 'dikirim' || rawStatus === 'sent') {
      normalizedStatus = 'SENT';
    } else if (event === 'message_read' || rawStatus === 'dibaca' || rawStatus === 'read') {
      normalizedStatus = 'READ';
    } else if (event === 'message_failed' || rawStatus === 'gagal' || rawStatus === 'error' || rawStatus === 'failed') {
      normalizedStatus = 'FAILED';
    } else if (event === 'blast_started' || rawStatus === 'progress' || rawStatus === 'pending') {
      normalizedStatus = 'PROCESSING';
    } else {
      console.log(`[WEBHOOK_UNKNOWN_EVENT] event=${event}, status=${rawStatus} - mapping as QUEUED`);
    }

    // 4. Update log status
    const messageId = data.wa_message_id || data.message_id || null;
    const { error: updateError } = await supabase
      .from('whatsapp_send_logs')
      .update({
        status: normalizedStatus,
        bablast_message_id: messageId,
        error_message: data.error,
        updated_at: new Date().toISOString(),
        ...(normalizedStatus === 'SENT' ? { sent_at: data.timestamp || new Date().toISOString() } : {}),
        ...(normalizedStatus === 'DELIVERED' ? { delivered_at: data.timestamp || new Date().toISOString() } : {}),
        ...(normalizedStatus === 'READ' ? { read_at: data.timestamp || new Date().toISOString() } : {})
      })
      .eq('id', latestLog.id);

    if (updateError) {
      console.error('Failed to update webhook log:', updateError);
      return NextResponse.json({ ok: false, error: 'Database error' }, { status: 500 });
    }

    // 5. Recalculate batch progress
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
          // Hanya hitung status final ke target_count
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

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
