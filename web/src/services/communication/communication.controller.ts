import { communicationService } from './communication.service';
import { listCommunicationLogs } from '@/lib/data/supabase/communication';
import type {
  CommunicationChannel,
  SendMessagePayload,
} from './communication.types';

export class CommunicationController {
  /**
   * Handler untuk pengiriman pesan komunikasi.
   */
  public async handleSendMessage(body: Partial<SendMessagePayload>, userEmail?: string) {
    if (!body.chatId) {
      return {
        status: 400,
        body: { ok: false, error: 'Parameter chatId wajib disertakan.' },
      };
    }

    const payload: SendMessagePayload = {
      channel: (body.channel as CommunicationChannel) || 'feishu',
      chatId: body.chatId,
      messageType: body.messageType || 'interactive_card',
      data: body.data,
      textContent: body.textContent,
      senderEmail: userEmail,
      templateId: body.templateId,
      cardTemplateId: body.cardTemplateId,
      cardConfig: body.cardConfig,
    };

    const result = await communicationService.send(payload);

    if (!result.ok) {
      return {
        status: 500,
        body: { ok: false, error: result.error, responseTimeMs: result.responseTimeMs },
      };
    }

    return {
      status: 200,
      body: { ok: true, data: result },
    };
  }

  /**
   * Handler untuk mendapatkan daftar Group yang tersimpan.
   */
  public async handleGetGroups(channel: CommunicationChannel = 'feishu') {
    try {
      const groups = await communicationService.getGroups(channel);
      return {
        status: 200,
        body: { ok: true, data: groups },
      };
    } catch (err: any) {
      return {
        status: 500,
        body: { ok: false, error: err?.message || 'Gagal memuat daftar group.' },
      };
    }
  }

  /**
   * Handler untuk menyinkronkan daftar Group langsung dari Feishu API.
   */
  public async handleSyncGroups(channel: CommunicationChannel = 'feishu') {
    try {
      const groups = await communicationService.syncGroups(channel);
      return {
        status: 200,
        body: { ok: true, data: groups, count: groups.length },
      };
    } catch (err: any) {
      return {
        status: 500,
        body: { ok: false, error: err?.message || 'Gagal menyinkronkan group dari Feishu API.' },
      };
    }
  }

  /**
   * Handler untuk mengambil log audit komunikasi.
   */
  public async handleGetLogs(limit = 50) {
    try {
      const logs = await listCommunicationLogs(limit);
      return {
        status: 200,
        body: { ok: true, data: logs },
      };
    } catch (err: any) {
      return {
        status: 500,
        body: { ok: false, error: err?.message || 'Gagal memuat riwayat log.' },
      };
    }
  }

  /**
   * Handler untuk Health Check diagnostik.
   */
  public async handleHealthCheck() {
    try {
      const health = await communicationService.healthCheck();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'unconfigured' ? 503 : 500;
      return {
        status: statusCode,
        body: health,
      };
    } catch (err: any) {
      return {
        status: 500,
        body: {
          status: 'error',
          token: 'error',
          bot: 'disconnected',
          chat_api: 'error',
          image_api: 'error',
          message_api: 'error',
          error: err?.message || 'Internal health check failure',
        },
      };
    }
  }
}

export const communicationController = new CommunicationController();
