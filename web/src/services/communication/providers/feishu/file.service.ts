import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import type { FeishuUploadFileResponse } from '../../communication.types';

const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuFileService {
  /**
   * Mengunggah file (misal file Excel .xlsx) ke Feishu Open Platform dan mengembalikan file_key.
   */
  public async uploadFile(
    fileBuffer: Buffer | Blob,
    fileName: string,
    fileType: 'stream' | 'opus' | 'mp4' | 'pdf' | 'doc' | 'xls' | 'ppt' = 'stream'
  ): Promise<string> {
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

    const fileKey = await withRetry(async () => {
      const response = await fetch(`${FEISHU_API_BASE}/im/v1/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Feishu Upload File HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result: FeishuUploadFileResponse = await response.json();

      if (result.code !== 0 || !result.data?.file_key) {
        throw new Error(`Feishu Upload File Error [${result.code}]: ${result.msg}`);
      }

      return result.data.file_key;
    }, { maxAttempts: 3, initialDelayMs: 500 });

    return fileKey;
  }
}

export const feishuFileService = new FeishuFileService();
