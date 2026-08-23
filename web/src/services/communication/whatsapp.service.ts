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

    // Prepare Bablast Bulk Request
    const bablastGroupCode = `LTM${Math.floor(10000 + Math.random() * 90000)}`;
    const bablastDelay = delaySeconds * 1000;

    const bablastContacts: BablastBulkContact[] = validTargets.map(t => {
      const vars = this.buildVariables(t, threshold);
      // Remove 'nama_sprinter' and 'phone' from variables if they conflict, though Bablast variables just replaces {key}
      return {
        nama: t.name,
        phone: t.phone_number!,
        variables: vars
      };
    });

    const bablastPayload = {
      group_name: `Push Mas Kurir - ${dropPointId}`,
      message: messageContent,
      delay: bablastDelay,
      kode: bablastGroupCode,
      sender_code: senderCode,
      contacts: bablastContacts
    };

    try {
      const response = await bablastService.sendBulk(bablastPayload);
      
      const { blast_id, group_id, group_code } = response.data || {};

      // Update Batch with Bablast IDs
      await updateBatch(batch.id, { 
        status: 'PROCESSING',
        blast_id: blast_id,
        bablast_group_id: group_id,
        group_code: group_code || bablastGroupCode
      });

      console.log(`[PUSH_MAS_KURIR] [BULK_SUBMITTED] batch_id=${batch.id} blast_id=${blast_id} total=${totalMessages}`);

      return {
        success: true,
        batchId: batch.id,
        status: 'PROCESSING',
        totalMessages
      };

    } catch (error: any) {
      console.error('[PUSH_MAS_KURIR] Fatal error publishing to Bablast Bulk API', error);
      await updateBatch(batch.id, { status: 'FAILED' });
      throw error;
    }
  }
}

export const whatsappService = new WhatsappService();
