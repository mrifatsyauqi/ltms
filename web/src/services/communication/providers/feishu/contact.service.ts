import { feishuAuthService } from './auth.service';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuBatchGetIdResponseSchema } from '../../communication.schemas';

export interface FeishuUserLookupResult {
  open_id: string;
  mobile?: string;
}

export class FeishuContactService {
  /** Feishu Contact API mewajibkan format E.164 (+62...). Nomor lokal Indonesia
   *  (081xxx / 62xxx) dinormalisasi dulu supaya pencarian tidak gagal cuma
   *  karena format, bukan karena orangnya memang tidak terdaftar. */
  private normalizeIndonesianMobile(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('62')) return `+${digits}`;
    if (digits.startsWith('0')) return `+62${digits.slice(1)}`;
    return `+62${digits}`;
  }

  /**
   * Mencari Open ID Feishu - khusus utk app/bot LTMS ini (Open ID di-scope
   * per-app, tidak sama dgn Open ID orang yg sama di app Feishu lain) -
   * berdasarkan nomor HP, memakai Contact API resmi batch_get_id. Ini
   * satu-satunya cara yang terjamin akurat, dibanding menebak dari Admin
   * Console yang navigasinya bisa beda-beda tergantung versi/region.
   */
  public async lookupOpenIdByMobile(phone: string): Promise<FeishuUserLookupResult | null> {
    const mobile = this.normalizeIndonesianMobile(phone);
    const { baseUrl } = getFeishuCredentials();
    const token = await feishuAuthService.getTenantAccessToken();

    const userList = await withRetry(
      async () => {
        const response = await fetchWithTimeout(
          `${baseUrl}/contact/v3/users/batch_get_id?user_id_type=open_id`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ mobiles: [mobile] }),
            timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
          }
        );

        if (!response.ok) {
          let detail = '';
          try {
            const errJson = await response.json();
            if (errJson?.msg || errJson?.code !== undefined) {
              detail = ` [Code ${errJson.code}]: ${errJson.msg || 'Tidak ada detail dari Feishu'}`;
            }
          } catch {
            // body bukan JSON valid - lanjut tanpa detail tambahan
          }
          throw new Error(
            `Feishu Lookup Open ID HTTP Error: ${response.status} ${response.statusText}${detail}`
          );
        }

        const rawJson = await response.json();
        const parsed = FeishuBatchGetIdResponseSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error(`Feishu Lookup Open ID Schema Mismatch: ${parsed.error.message}`);
        }

        const result = parsed.data;

        if (result.code !== 0) {
          throw new Error(
            `Feishu Lookup Open ID Error [Code ${result.code}]: ${result.msg || 'Gagal mencari Open ID'}`
          );
        }

        return result.data?.user_list || [];
      },
      { maxAttempts: 3, initialDelayMs: 500 }
    );

    const match = userList.find((u) => u.user_id);
    if (!match?.user_id) return null;

    return { open_id: match.user_id, mobile: match.mobile };
  }
}

export const feishuContactService = new FeishuContactService();
