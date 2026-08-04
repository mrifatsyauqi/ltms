import { communicationCache } from '../../utils/cache';
import { withRetry } from '../../utils/retry';
import type { FeishuTenantTokenResponse } from '../../communication.types';

const TOKEN_CACHE_KEY = 'feishu_tenant_access_token';
const FEISHU_API_BASE = 'https://open.feishu.cn/open-apis';

export class FeishuAuthService {
  private appId: string;
  private appSecret: string;

  constructor() {
    this.appId = (process.env.FEISHU_APP_ID || '').trim();
    this.appSecret = (process.env.FEISHU_APP_SECRET || '').trim();
  }

  /**
   * Memeriksa apakah kredensial Feishu telah dikonfigurasi pada environment.
   */
  public isConfigured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  /**
   * Mengambil Tenant Access Token dari cache atau melakukan request baru ke Feishu Open Platform.
   */
  public async getTenantAccessToken(): Promise<string> {
    // 1. Cek Cache
    const cachedToken = communicationCache.get<string>(TOKEN_CACHE_KEY);
    if (cachedToken) {
      return cachedToken;
    }

    // 2. Validasi konfigurasi
    if (!this.isConfigured()) {
      // Jika environment belum diisi (misal testing lokal), lempar error spesifik
      throw new Error(
        'Kredensial FEISHU_APP_ID atau FEISHU_APP_SECRET belum dikonfigurasi di Environment Variable.'
      );
    }

    // 3. Request ke Feishu Internal Token API dengan retry 3x
    const token = await withRetry(async () => {
      const response = await fetch(
        `${FEISHU_API_BASE}/auth/v3/tenant_access_token/internal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            app_id: this.appId,
            app_secret: this.appSecret,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Feishu Auth HTTP Error: ${response.status} ${response.statusText}`);
      }

      const result: FeishuTenantTokenResponse = await response.json();

      if (result.code !== 0 || !result.tenant_access_token) {
        throw new Error(`Feishu Auth API Error [${result.code}]: ${result.msg}`);
      }

      // Cache token dengan buffer waktu (expire - 300 detik atau default 7000 detik)
      const ttl = result.expire ? Math.max(result.expire - 300, 60) : 7000;
      communicationCache.set(TOKEN_CACHE_KEY, result.tenant_access_token, ttl);

      return result.tenant_access_token;
    }, { maxAttempts: 3, initialDelayMs: 500 });

    return token;
  }
}

export const feishuAuthService = new FeishuAuthService();
