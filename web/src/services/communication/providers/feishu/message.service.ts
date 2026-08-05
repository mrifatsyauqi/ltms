import { feishuAuthService } from './auth.service';
import { feishuImageService } from './image.service';
import { feishuCardService } from './card.service';
import { feishuChatService } from './chat.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { communicationSendQueue } from '../../utils/queue';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuSendMessageResponseSchema } from '../../communication.schemas';
import type {
  ICommunicationProvider,
} from '../../communication.interface';
import type {
  CommunicationChannel,
  SendMessagePayload,
  SendMessageResult,
  FeishuGroup,
} from '../../communication.types';

export class FeishuMessageService implements ICommunicationProvider {
  public readonly channel: CommunicationChannel = 'feishu';

  /**
   * Mengirim pesan ke Group Feishu (Interactive Card, Image, File, atau Text)
   * Diproses melalui Promise Concurrency Queue dan divalidasi dengan schema Zod.
   */
  public async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    return communicationSendQueue.add(async () => {
      const startTime = Date.now();
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      let uploadedImageKey: string | undefined = payload.data?.imageKey;
      const { baseUrl } = getFeishuCredentials();

      try {
        // 1. Ambil Tenant Access Token
        const token = await feishuAuthService.getTenantAccessToken();

        // 2. Jika ada imageBase64 dan belum ada imageKey, upload gambar terlebih dahulu
        if (payload.data?.imageBase64 && !uploadedImageKey) {
          uploadedImageKey = await feishuImageService.uploadImage(payload.data.imageBase64);
        }

        // 3. Bangun struktur pesan berdasarkan messageType
        let msgType = 'text';
        let contentObj: any = {};

        if (payload.messageType === 'interactive_card' && payload.data) {
          msgType = 'interactive';
          if (payload.cardConfig) {
            const { CardCompilerService } = await import('../../configuration/card-compiler.service');
            contentObj = CardCompilerService.compile(payload.cardConfig as any, payload.data, uploadedImageKey);
          } else {
            contentObj = feishuCardService.generateCard(
              payload.data,
              uploadedImageKey
            );
          }
        } else if (payload.messageType === 'image' && uploadedImageKey) {
          msgType = 'image';
          contentObj = { image_key: uploadedImageKey };
        } else if (payload.messageType === 'file' && payload.data?.imageKey) {
          msgType = 'file';
          contentObj = { file_key: payload.data.imageKey };
        } else {
          msgType = 'text';
          contentObj = {
            text: payload.textContent || payload.data?.caption || 'Pesan dari LTMS Enterprise',
          };
        }

        // 4. Kirim pesan ke API Feishu dengan Retry 3x dan Timeout 15s
        const messageResult = await withRetry(
          async () => {
            const endpoint = `${baseUrl}/im/v1/messages?receive_id_type=chat_id`;
            const response = await fetchWithTimeout(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json; charset=utf-8',
              },
              body: JSON.stringify({
                receive_id: payload.chatId,
                msg_type: msgType,
                content: JSON.stringify(contentObj),
              }),
              timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
            });

            if (!response.ok) {
              throw new Error(
                `Feishu Send Message HTTP Error: ${response.status} ${response.statusText}`
              );
            }

            const rawJson = await response.json();
            const parsed = FeishuSendMessageResponseSchema.safeParse(rawJson);

            if (!parsed.success) {
              throw new Error(`Feishu Send Message Schema Mismatch: ${parsed.error.message}`);
            }

            const result = parsed.data;

            if (result.code !== 0) {
              throw new Error(
                `Feishu Send Message Error [Code ${result.code}]: ${result.msg || 'Gagal mengirim pesan'}`
              );
            }

            return result.data;
          },
          { maxAttempts: 3, initialDelayMs: 500 }
        );

        const responseTimeMs = Date.now() - startTime;

        return {
          ok: true,
          messageId: messageResult?.message_id,
          channel: 'feishu',
          chatId: payload.chatId,
          responseTimeMs,
          imageKey: uploadedImageKey,
        };
      } catch (err: any) {
        const responseTimeMs = Date.now() - startTime;
        return {
          ok: false,
          channel: 'feishu',
          chatId: payload.chatId,
          responseTimeMs,
          imageKey: uploadedImageKey,
          error: err?.message || 'Gagal mengirim pesan ke Feishu',
        };
      }
    });
  }

  /**
   * Menyinkronkan daftar Group yang diikuti oleh bot.
   */
  public async syncChats(): Promise<FeishuGroup[]> {
    return feishuChatService.syncChats();
  }
}

export const feishuMessageService = new FeishuMessageService();
