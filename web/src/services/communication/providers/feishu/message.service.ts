import { feishuAuthService } from './auth.service';
import { feishuImageService } from './image.service';
import { feishuCardService } from './card.service';
import { feishuChatService } from './chat.service';
import { withRetry } from '../../utils/retry';
import type {
  ICommunicationProvider,
} from '../../communication.interface';
import type {
  CommunicationChannel,
  SendMessagePayload,
  SendMessageResult,
  FeishuSendMessageResponse,
  FeishuGroup,
} from '../../communication.types';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuMessageService implements ICommunicationProvider {
  public readonly channel: CommunicationChannel = 'feishu';

  /**
   * Mengirim pesan ke Group Feishu (Text, Image, File, atau Interactive Card).
   */
  public async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    const startTime = Date.now();
    let uploadedImageKey: string | undefined = payload.data?.imageKey;

    try {
      // 1. Ambil Tenant Access Token
      const token = await feishuAuthService.getTenantAccessToken();

      // 2. Jika ada imageBase64 dan belum memiliki imageKey, unggah gambar terlebih dahulu
      if (payload.data?.imageBase64 && !uploadedImageKey) {
        uploadedImageKey = await feishuImageService.uploadImage(payload.data.imageBase64);
      }

      // 3. Bangun content pesan berdasarkan messageType
      let msgType = 'text';
      let contentObj: any = {};

      if (payload.messageType === 'interactive_card' && payload.data) {
        msgType = 'interactive';
        contentObj = feishuCardService.generateMonitoringIncCard(
          payload.data,
          uploadedImageKey
        );
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

      // 4. Kirim pesan ke API Feishu dengan Retry 3x
      const messageResult = await withRetry(async () => {
        const response = await fetch(
          `${FEISHU_API_BASE}/im/v1/messages?receive_id_type=chat_id`,
          {
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
          }
        );

        if (!response.ok) {
          throw new Error(
            `Feishu Send Message HTTP Error: ${response.status} ${response.statusText}`
          );
        }

        const result: FeishuSendMessageResponse = await response.json();

        if (result.code !== 0) {
          throw new Error(`Feishu Send Message Error [${result.code}]: ${result.msg}`);
        }

        return result.data;
      }, { maxAttempts: 3, initialDelayMs: 500 });

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
  }

  /**
   * Menyinkronkan daftar Group yang diikuti oleh bot.
   */
  public async syncChats(): Promise<FeishuGroup[]> {
    return feishuChatService.syncChats();
  }
}

export const feishuMessageService = new FeishuMessageService();
