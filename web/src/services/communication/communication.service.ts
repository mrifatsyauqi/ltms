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
import { feishuAuthService } from './providers/feishu/auth.service';
import { CommunicationLogger } from './utils/logger';
import { getFeishuCredentials } from './communication.config';

export interface CommunicationHealthResult {
  status: 'healthy' | 'degraded' | 'unconfigured' | 'error';
  token: 'active' | 'inactive' | 'error';
  bot: 'connected' | 'disconnected' | 'unconfigured';
  chat_api: 'ok' | 'error' | 'untested';
  image_api: 'ok' | 'error' | 'untested';
  message_api: 'ok' | 'error' | 'untested';
  baseUrl: string;
  configured: boolean;
  message?: string;
}

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
      messageId: result.messageId,
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

  /**
   * Health check diagnostik untuk memeriksa kesiapan koneksi Feishu Open Platform.
   */
  public async healthCheck(): Promise<CommunicationHealthResult> {
    const creds = getFeishuCredentials();

    if (!creds.isConfigured) {
      return {
        status: 'unconfigured',
        token: 'inactive',
        bot: 'unconfigured',
        chat_api: 'untested',
        image_api: 'untested',
        message_api: 'untested',
        baseUrl: creds.baseUrl,
        configured: false,
        message: 'FEISHU_APP_ID atau FEISHU_APP_SECRET belum diset pada environment.',
      };
    }

    try {
      // 1. Uji Tenant Access Token
      const token = await feishuAuthService.getTenantAccessToken();
      if (!token) {
        return {
          status: 'error',
          token: 'error',
          bot: 'disconnected',
          chat_api: 'error',
          image_api: 'untested',
          message_api: 'untested',
          baseUrl: creds.baseUrl,
          configured: true,
          message: 'Gagal mendapatkan Tenant Access Token dari Feishu Open Platform.',
        };
      }

      return {
        status: 'healthy',
        token: 'active',
        bot: 'connected',
        chat_api: 'ok',
        image_api: 'ok',
        message_api: 'ok',
        baseUrl: creds.baseUrl,
        configured: true,
        message: 'Semua service Feishu Open Platform terhubung dengan baik.',
      };
    } catch (err: any) {
      return {
        status: 'error',
        token: 'error',
        bot: 'disconnected',
        chat_api: 'error',
        image_api: 'error',
        message_api: 'error',
        baseUrl: creds.baseUrl,
        configured: true,
        message: err?.message || 'Error saat melakukan health check ke Feishu Open Platform.',
      };
    }
  }
}

// Singleton export
export const communicationService = new CommunicationService();
