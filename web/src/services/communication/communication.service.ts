import type {
  ICommunicationProvider,
  ICommunicationService,
} from './communication.interface';
import type {
  CommunicationChannel,
  SendMessagePayload,
  SendMessageResult,
  FeishuGroup,
} from './communication.types';
import { feishuMessageService } from './providers/feishu/message.service';
import { feishuChatService } from './providers/feishu/chat.service';
import { CommunicationLogger } from './utils/logger';

export class CommunicationService implements ICommunicationService {
  private providers = new Map<CommunicationChannel, ICommunicationProvider>();

  constructor() {
    // Register Default Providers
    this.registerProvider(feishuMessageService);
  }

  /**
   * Mendaftarkan provider komunikasi baru (Feishu, dsb).
   */
  public registerProvider(provider: ICommunicationProvider): void {
    this.providers.set(provider.channel, provider);
  }

  /**
   * Mengirim pesan / laporan melalui channel komunikasi yang dipilih.
   */
  public async send(payload: SendMessagePayload): Promise<SendMessageResult> {
    const channel = payload.channel || 'feishu';
    const provider = this.providers.get(channel);

    if (!provider) {
      const errorResult: SendMessageResult = {
        ok: false,
        channel,
        chatId: payload.chatId,
        responseTimeMs: 0,
        error: `Provider untuk channel '${channel}' belum terdaftar atau tidak didukung.`,
      };

      await CommunicationLogger.log({
        channel,
        chatId: payload.chatId,
        messageType: payload.messageType,
        status: 'FAILED',
        error: errorResult.error,
        responseTimeMs: 0,
        senderEmail: payload.senderEmail,
        payloadSummary: { targetKota: payload.data?.targetKota },
      });

      return errorResult;
    }

    // Eksekusi pengiriman melalui provider
    const result = await provider.sendMessage(payload);

    // Audit Logging ke Supabase Database
    await CommunicationLogger.log({
      channel,
      chatId: payload.chatId,
      messageType: payload.messageType,
      status: result.ok ? 'SUCCESS' : 'FAILED',
      error: result.error || null,
      responseTimeMs: result.responseTimeMs,
      senderEmail: payload.senderEmail,
      payloadSummary: payload.data
        ? {
            targetKota: payload.data.targetKota,
            total: payload.data.total,
            belum: payload.data.belum,
            late: payload.data.late,
            percent: payload.data.percent,
            imageKey: result.imageKey,
            messageId: result.messageId,
          }
        : { textLength: payload.textContent?.length || 0 },
    });

    return result;
  }

  /**
   * Mengambil daftar group tersimpan dari channel yang dipilih.
   */
  public async getGroups(channel: CommunicationChannel = 'feishu'): Promise<FeishuGroup[]> {
    if (channel === 'feishu') {
      return feishuChatService.getGroups();
    }
    return [];
  }

  /**
   * Menyinkronkan daftar group dari remote API channel yang dipilih.
   */
  public async syncGroups(channel: CommunicationChannel = 'feishu'): Promise<FeishuGroup[]> {
    if (channel === 'feishu') {
      return feishuChatService.syncChats();
    }
    return [];
  }
}

// Singleton export
export const communicationService = new CommunicationService();
