import { bablastService, BablastBulkContact } from './providers/whatsapp/bablast.service';
import { Client } from "@upstash/qstash";
import { 
  createSendBatch, 
  createSendLogs, 
  updateBatch,
  WhatsappTemplate
} from '@/lib/data/supabase/whatsapp';

export type SendTarget = {
  sprinter_id: string;
  name: string;
  phone_number?: string; 
  drop_point_id: string;
  total_delivery: number;
  clear_ttd: number;
  belum_ttd: number;
  persentase_ttd: number;
};

export class WhatsappService {
  
  /**
   * Translates LTMS template syntax {{var}} to Bablast syntax {var}
   */
  private convertTemplateSyntax(template: string): string {
    return template.replace(/\{\{([^}]+)\}\}/g, '{$1}');
  }

  /**
   * Prepares the variables array for Bablast API based on target
   */
  private buildVariables(target: SendTarget, targetTtd: number): { key: string, value: string }[] {
    const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return [
      { key: 'nama_sprinter', value: target.name },
      { key: 'total_delivery', value: target.total_delivery.toString() },
      { key: 'clear_ttd', value: target.clear_ttd.toString() },
      { key: 'belum_ttd', value: target.belum_ttd.toString() },
      { key: 'persentase_ttd', value: target.persentase_ttd.toFixed(2) },
      { key: 'target_ttd', value: targetTtd.toString() },
      { key: 'drop_point', value: target.drop_point_id },
      { key: 'tanggal', value: today },
    ];
  }

  async processBlast(
    targets: SendTarget[], 
    template: WhatsappTemplate, 
    threshold: number, 
    operator: string,
    userEmail: string,
    senderCode: string,
    delaySeconds: number = 10,
    dropPointId: string
  ) {
    const validTargets = targets.filter(t => t.phone_number && t.phone_number.trim() !== '');
    if (validTargets.length === 0) {
      throw new Error('Tidak ada kontak dengan nomor WhatsApp yang valid.');
    }

    const totalMessages = validTargets.length;
    
    // Create the main Batch record
    const batch = await createSendBatch({
      module: 'monitoring_delivery',
      drop_point_id: dropPointId,
      sender_code: senderCode,
      delay_seconds: delaySeconds,
      template_id: template.id,
      filter_operator: operator,
      threshold,
      total_messages: totalMessages,
      queued_count: totalMessages,
      success_count: 0,
      failed_count: 0,
      target_count: totalMessages, // legacy
      submitted_count: 0, // legacy
      status: 'QUEUED',
      created_by: userEmail
    });

    const messageContent = this.convertTemplateSyntax(template.content);

    // Prepare all message logs
    const logEntries = validTargets.map((t, index) => {
      let messageText = messageContent;
      const variables = this.buildVariables(t, threshold);
      for (const v of variables) {
        messageText = messageText.replace(`{${v.key}}`, v.value);
      }

      return {
        batch_id: batch.id,
        drop_point_id: dropPointId,
        sender_code: senderCode,
        sequence_number: index + 1,
        sprinter_id: t.sprinter_id,
        phone_number: t.phone_number!,
        rendered_message: messageText,
        status: 'QUEUED' as any
      };
    });

    // Bulk insert logs
    const createdLogs = await createSendLogs(logEntries);
    if (!createdLogs || createdLogs.length === 0) {
      throw new Error('Gagal menyimpan target penerima ke database.');
    }

    // Publish First Job to QStash
    try {
      const qstashClient = new Client({
        token: process.env.QSTASH_TOKEN || '',
      });
      
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
      if (!appUrl) {
        throw new Error('APP_URL environment variable is not defined.');
      }
      
      const firstLog = createdLogs.find((l: any) => l.sequence_number === 1);
      if (!firstLog) throw new Error('First log not returned from insert.');

      const publishPayload = {
        batch_id: batch.id,
        message_id: firstLog.id,
        sequence_number: 1
      };

      await qstashClient.publishJSON({
        url: `${appUrl}/api/worker/push-mas-kurir`,
        body: publishPayload,
        // No delay for the first message
      });

      console.log(`[PUSH_MAS_KURIR] [BATCH_QUEUED] batch_id=${batch.id} total=${totalMessages} first_job_published`);

      return {
        success: true,
        batchId: batch.id,
        status: 'QUEUED',
        totalMessages
      };

    } catch (error: any) {
      console.error('[PUSH_MAS_KURIR] Fatal error publishing to QStash', error);
      await updateBatch(batch.id, { status: 'FAILED' });
      throw error;
    }
  }
}

export const whatsappService = new WhatsappService();
