import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuUploadImageResponseSchema } from '../../communication.schemas';

export class FeishuImageService {
  /**
   * Mengunggah gambar (Base64 atau Data URL) ke Feishu Open Platform dan mengembalikan image_key.
   */
  public async uploadImage(base64OrDataUrl: string): Promise<string> {
    if (!base64OrDataUrl) {
      throw new Error('Image data is empty or invalid.');
    }

    const { baseUrl } = getFeishuCredentials();

    // 1. Ambil Tenant Access Token
    const token = await feishuAuthService.getTenantAccessToken();

    // 2. Parse Base64 menjadi Uint8Array / Blob
    const cleanBase64 = base64OrDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: 'image/png' });

    // 3. Buat FormData multipart standar
    const formData = new FormData();
    formData.append('image_type', 'message');
    formData.append('image', blob, 'monitoring_inc_report.png');

    // 4. Upload ke Feishu API dengan Retry 3x dan Timeout 15s
    const imageKey = await withRetry(
      async () => {
        const response = await fetchWithTimeout(`${baseUrl}/im/v1/images`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
        });

        if (!response.ok) {
          throw new Error(`Feishu Upload Image HTTP Error: ${response.status} ${response.statusText}`);
        }

        const rawJson = await response.json();
        const parsed = FeishuUploadImageResponseSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error(`Feishu Image Upload Schema Mismatch: ${parsed.error.message}`);
        }

        const result = parsed.data;

        if (result.code !== 0 || !result.data?.image_key) {
          throw new Error(`Feishu Upload Image Error [Code ${result.code}]: ${result.msg || 'Image key tidak ditemukan'}`);
        }

        return result.data.image_key;
      },
      { maxAttempts: 3, initialDelayMs: 500 }
    );

    return imageKey;
  }
}

export const feishuImageService = new FeishuImageService();
