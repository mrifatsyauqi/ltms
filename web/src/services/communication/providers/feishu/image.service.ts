import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import type { FeishuUploadImageResponse } from '../../communication.types';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuImageService {
  /**
   * Mengunggah gambar (Base64 atau Buffer) ke Feishu Open Platform dan mengembalikan image_key.
   */
  public async uploadImage(base64OrDataUrl: string): Promise<string> {
    if (!base64OrDataUrl) {
      throw new Error('Image data is empty or invalid.');
    }

    // 1. Ambil Tenant Access Token
    const token = await feishuAuthService.getTenantAccessToken();

    // 2. Parse Base64 menjadi Buffer/Blob
    const cleanBase64 = base64OrDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });

    // 3. Buat FormData multipart
    const formData = new FormData();
    formData.append('image_type', 'message');
    formData.append('image', blob, 'monitoring_inc_report.png');

    // 4. Upload ke Feishu API dengan Retry 3x
    const imageKey = await withRetry(async () => {
      const response = await fetch(`${FEISHU_API_BASE}/im/v1/images`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Feishu Upload Image HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result: FeishuUploadImageResponse = await response.json();

      if (result.code !== 0 || !result.data?.image_key) {
        throw new Error(`Feishu Upload Image Error [${result.code}]: ${result.msg}`);
      }

      return result.data.image_key;
    }, { maxAttempts: 3, initialDelayMs: 500 });

    return imageKey;
  }
}

export const feishuImageService = new FeishuImageService();
