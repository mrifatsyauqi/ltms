import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuUploadFileResponseSchema } from '../../communication.schemas';

export class FeishuFileService {
  /**
   * Mengunggah file (misal file Excel .xlsx / berkas data) ke Feishu Open Platform dan mengembalikan file_key.
   */
  public async uploadFile(
    fileBuffer: Buffer | Blob | Uint8Array,
    fileName: string,
    fileType: 'stream' | 'opus' | 'mp4' | 'pdf' | 'doc' | 'xls' | 'ppt' = 'stream'
  ): Promise<string> {
    const { baseUrl } = getFeishuCredentials();
    const token = await feishuAuthService.getTenantAccessToken();

    const formData = new FormData();
    formData.append('file_type', fileType);
    formData.append('file_name', fileName);

    if (fileBuffer instanceof Blob) {
      formData.append('file', fileBuffer, fileName);
    } else {
      const uint8 = new Uint8Array(fileBuffer);
      const blob = new Blob([uint8]);
      formData.append('file', blob, fileName);
    }

    const fileKey = await withRetry(
      async () => {
        const response = await fetchWithTimeout(`${baseUrl}/im/v1/files`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
          timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
        });

        if (!response.ok) {
          throw new Error(`Feishu Upload File HTTP Error: ${response.status} ${response.statusText}`);
        }

        const rawJson = await response.json();
        const parsed = FeishuUploadFileResponseSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error(`Feishu File Upload Schema Mismatch: ${parsed.error.message}`);
        }

        const result = parsed.data;

        if (result.code !== 0 || !result.data?.file_key) {
          throw new Error(`Feishu Upload File Error [Code ${result.code}]: ${result.msg || 'File key tidak ditemukan'}`);
        }

        return result.data.file_key;
      },
      { maxAttempts: 3, initialDelayMs: 500 }
    );

    return fileKey;
  }
}

export const feishuFileService = new FeishuFileService();
