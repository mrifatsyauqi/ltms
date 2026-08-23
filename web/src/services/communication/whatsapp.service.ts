import { bablastService, BablastBulkContact } from './providers/whatsapp/bablast.service';
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
    senderCode: string
  ) {
    const validTargets = targets.filter(t => t.phone_number && t.phone_number.trim() !== '');
    if (validTargets.length === 0) {
      throw new Error('Tidak ada kontak dengan nomor WhatsApp yang valid.');
    }

    const batch = await createSendBatch({
      module: 'monitoring_delivery',
      template_id: template.id,
      filter_operator: operator,
      threshold,
      target_count: validTargets.length,
      submitted_count: 0,
      status: 'sending',
      created_by: userEmail
    });

    const messageContent = this.convertTemplateSyntax(template.content);
    const contacts: BablastBulkContact[] = validTargets.map(t => ({
      nama: t.name,
      phone: t.phone_number!,
      variables: this.buildVariables(t, threshold)
    }));

    try {
      // Fallback from bulk to individual POST /send reusing proven sendTestMessage flow
      // as bulk endpoint causes 404
      let successCount = 0;
      
      for (const t of validTargets) {
        console.log(`[PUSH_MAS_KURIR] dp_id=${t.drop_point_id} sender_code=${senderCode} recipient=${t.phone_number}`);
        
        let messageText = messageContent;
        const variables = this.buildVariables(t, threshold);
        for (const v of variables) {
          messageText = messageText.replace(`{${v.key}}`, v.value);
        }

        const response = await bablastService.sendTestMessage({
          phone: t.phone_number!,
          message: messageText,
          sender_code: senderCode
        });

        console.log(`[BABLAST_SEND] endpoint=/send status=${response.ok ? 'SUCCESS' : 'FAILED'} recipient=${t.phone_number}`);

        await createSendLogs([{
          batch_id: batch.id,
          sprinter_id: t.sprinter_id,
          phone_number: t.phone_number!,
          rendered_message: messageText,
          status: response.ok ? 'sent' : 'failed'
        }]);

        if (response.ok) {
          successCount++;
        }
      }

      await updateBatch(batch.id, {
        status: 'submitted',
        submitted_count: successCount
      });

      return {
        batchId: batch.id,
        targetCount: successCount,
        message: 'Pengiriman selesai diproses'
      };

    } catch (error: any) {
      console.error('[PUSH_MAS_KURIR] Fatal error processing blast', error);
      await updateBatch(batch.id, { status: 'failed' });
      throw error;
    }
  }
}

export const whatsappService = new WhatsappService();
