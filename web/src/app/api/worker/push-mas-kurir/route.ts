import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from "@upstash/qstash/dist/nextjs";
import { db } from '@/lib/data/supabase/client';
import { bablastService } from '@/services/communication/providers/whatsapp/bablast.service';
import { Client } from "@upstash/qstash";

export const maxDuration = 60; // Max execution time for Next.js function

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { batch_id, message_id, sequence_number } = body;

    if (!batch_id || !message_id || !sequence_number) {
      console.error('[PUSH_MAS_KURIR] Worker Error: Missing payload fields');
      return NextResponse.json({ ok: false, error: 'Missing fields' }, { status: 400 });
    }

    const supabase = db();
    
    // ATOMIC CLAIM: Update status from QUEUED to SENDING
    const { data: log, error: claimError } = await supabase
      .from('whatsapp_send_logs')
      .update({ status: 'SENDING' })
      .eq('id', message_id)
      .eq('status', 'QUEUED')
      .select('*')
      .maybeSingle();

    if (claimError || !log) {
      // Idempotency check: if not QUEUED, check if it's already SENT or SENDING
      const { data: existing } = await supabase.from('whatsapp_send_logs').select('status').eq('id', message_id).maybeSingle();
      if (existing && existing.status !== 'QUEUED') {
        console.log(`[PUSH_MAS_KURIR] Message ${message_id} already processed (Status: ${existing.status}). Skipping.`);
        return NextResponse.json({ ok: true, skipped: true });
      }
      throw new Error(`Failed to claim message ${message_id}`);
    }

    // Get Batch details
    const { data: batch, error: batchError } = await supabase
      .from('whatsapp_send_batches')
      .select('*')
      .eq('id', batch_id)
      .single();

    if (batchError || !batch) {
      throw new Error(`Batch not found for message ${message_id}`);
    }
    
    // IF batch was just QUEUED, move it to PROCESSING
    if (batch.status === 'QUEUED') {
      await supabase.from('whatsapp_send_batches').update({ 
        status: 'PROCESSING',
        started_at: new Date().toISOString()
      }).eq('id', batch_id);
      console.log(`[PUSH_MAS_KURIR] [BATCH_PROCESSING] batch_id=${batch.id}`);
    }

    // POST /send to Bablast
    console.log(`[PUSH_MAS_KURIR] [MESSAGE_SENDING] seq=${sequence_number} phone=${log.phone_number} sender=${batch.sender_code}`);
    
    const response = await bablastService.sendTestMessage({
      phone: log.phone_number,
      message: log.rendered_message,
      sender_code: batch.sender_code
    });

    const isSuccess = response.ok;
    const nextStatus = isSuccess ? 'SENT' : 'FAILED';
    const timestampField = isSuccess ? 'sent_at' : undefined;

    console.log(`[PUSH_MAS_KURIR] [MESSAGE_${nextStatus}] seq=${sequence_number} msg_id=${message_id}`);

    // Update Message
    const updateData: any = { 
      status: nextStatus,
      updated_at: new Date().toISOString()
    };
    
    if (isSuccess) {
      updateData.sent_at = new Date().toISOString();
      updateData.bablast_message_id = response.data?.message_id || null;
    } else {
      updateData.error_message = response.error || 'Unknown Error';
    }

    await supabase.from('whatsapp_send_logs').update(updateData).eq('id', message_id);

    // Update Batch Counters
    const counterField = isSuccess ? 'success_count' : 'failed_count';
    
    // We fetch the current values and increment to avoid race conditions. 
    // Usually RPC is better, but this chained job inherently avoids race conditions between messages of the same batch.
    const { data: latestBatch } = await supabase.from('whatsapp_send_batches').select('queued_count, success_count, failed_count').eq('id', batch_id).single();
    if (latestBatch) {
      await supabase.from('whatsapp_send_batches').update({
        queued_count: Math.max(0, latestBatch.queued_count - 1),
        [counterField]: latestBatch[counterField] + 1
      }).eq('id', batch_id);
    }

    // Schedule next job if not final
    if (sequence_number < batch.total_messages) {
      const { data: nextLog } = await supabase
        .from('whatsapp_send_logs')
        .select('id')
        .eq('batch_id', batch_id)
        .eq('sequence_number', sequence_number + 1)
        .single();
        
      if (nextLog) {
        const qstashClient = new Client({
          token: process.env.QSTASH_TOKEN || '',
        });
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
        
        await qstashClient.publishJSON({
          url: `${appUrl}/api/worker/push-mas-kurir`,
          body: {
            batch_id,
            message_id: nextLog.id,
            sequence_number: sequence_number + 1
          },
          delay: batch.delay_seconds || 10
        });
      }
    } else {
      // Finalize Batch
      const { data: finalStats } = await supabase.from('whatsapp_send_batches').select('success_count, failed_count').eq('id', batch_id).single();
      const finalStatus = (finalStats && finalStats.failed_count > 0) ? 'PARTIAL' : 'COMPLETED';
      
      await supabase.from('whatsapp_send_batches').update({
        status: finalStatus,
        completed_at: new Date().toISOString()
      }).eq('id', batch_id);
      
      console.log(`[PUSH_MAS_KURIR] [BATCH_COMPLETED] batch_id=${batch_id} status=${finalStatus}`);
    }

    return NextResponse.json({ ok: true, status: nextStatus });

  } catch (error: any) {
    console.error('[PUSH_MAS_KURIR] Worker Error:', error);
    // Transient errors should throw so QStash retries
    // But we only want to retry if the message hasn't been sent.
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// Next.js QStash signature verification middleware
export const POST = verifySignatureAppRouter(handler);
