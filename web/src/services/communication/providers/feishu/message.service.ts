import { feishuAuthService } from './auth.service';
import { feishuImageService } from './image.service';
import { feishuChatService } from './chat.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { communicationSendQueue } from '../../utils/queue';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuSendMessageResponseSchema } from '../../communication.schemas';
import { CardCompilerService } from '../../configuration/card-compiler.service';
import { cardTemplateService } from '../../configuration/card-template.service';
import { mentionService } from '../../configuration/mention.service';
import { STARTER_PRESETS } from '../../configuration/template-presets';
import type { ICommunicationProvider } from '../../communication.interface';
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

        if (payload.messageType === 'interactive_card' || (payload.data && !payload.textContent)) {
          msgType = 'interactive';
          const moduleName = (payload.data?.module as any) || 'monitoring_inc';

          // A. Resolve blocksConfig
          let blocksConfig = payload.cardConfig;
          if (!blocksConfig && payload.cardTemplateId) {
            const tpl = await cardTemplateService.getById(payload.cardTemplateId);
            if (tpl?.blocks_config) {
              blocksConfig = tpl.blocks_config as any;
            }
          }

          if (!blocksConfig) {
            try {
              const defaultTpl = await cardTemplateService.getDefault(moduleName);
              if (defaultTpl?.blocks_config) {
                blocksConfig = defaultTpl.blocks_config as any;
              }
            } catch {
              // fallback to starter preset
            }
          }

          if (!blocksConfig) {
            const preset = STARTER_PRESETS.find((p) => p.module === moduleName) || STARTER_PRESETS[0];
            blocksConfig = preset.blocksConfig;
          }

          // B. Resolve Mention Mappings
          let mentionMap: Map<string, any> = new Map();
          try {
            if (moduleName === 'monitoring_inc') {
              const subdistrictKeys: string[] = [];
              if (Array.isArray(payload.data?.subdistricts)) {
                payload.data.subdistricts.forEach((s: any) => {
                  if (typeof s === 'object' && s.name) subdistrictKeys.push(s.name);
                });
              } else if ((payload.data as any)?.destination_subdistricts) {
                const lines = String((payload.data as any).destination_subdistricts).split('\n');
                lines.forEach((l) => {
                  const m = l.match(/^([^:\(\d]+)/);
                  if (m) subdistrictKeys.push(m[1].trim().replace(/^📍\s*/, ''));
                });
              }
              if (subdistrictKeys.length > 0) {
                mentionMap = await mentionService.getMentionsByKeys('kecamatan', subdistrictKeys);
              }
            } else if (moduleName === 'monitoring_delivery') {
              const kurirKeys: string[] = [];
              if (Array.isArray(payload.data?.kurirList)) {
                payload.data.kurirList.forEach((k: any) => {
                  if (typeof k === 'object' && k.name) kurirKeys.push(k.name);
                });
              }
              if (kurirKeys.length > 0) {
                mentionMap = await mentionService.getMentionsByKeys('kurir', kurirKeys);
              }
            }
          } catch {
            // Non-blocking fallback jika lookup mention database gagal
          }

          // C. Single Source of Truth Compilation
          contentObj = CardCompilerService.compileCard(
            blocksConfig as any,
            payload.data,
            uploadedImageKey,
            mentionMap
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
          error: err.message || 'Gagal mengirim pesan Feishu',
        };
      }
    });
  }

  public async syncGroups(): Promise<FeishuGroup[]> {
    return feishuChatService.syncGroups();
  }

  public async getActiveGroups(): Promise<FeishuGroup[]> {
    return feishuChatService.getActiveGroups();
  }
}

export const feishuMessageService = new FeishuMessageService();
