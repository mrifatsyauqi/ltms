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
    userEmail: string
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
      const response = await bablastService.sendBulk({
        message: messageContent,
        contacts,
        delay: 3000
      });

      const logs = validTargets.map(t => ({
        batch_id: batch.id,
        sprinter_id: t.sprinter_id,
        phone_number: t.phone_number!,
        rendered_message: 'Pesan diteruskan ke provider',
        status: 'pending' as const
      }));
      await createSendLogs(logs);
      
      await updateBatch(batch.id, {
        status: 'submitted',
        submitted_count: validTargets.length
      });

      return {
        batchId: batch.id,
        targetCount: validTargets.length,
        message: response.message
      };

    } catch (error: any) {
      await updateBatch(batch.id, { status: 'failed' });
      throw error;
    }
  }
}

export const whatsappService = new WhatsappService();
