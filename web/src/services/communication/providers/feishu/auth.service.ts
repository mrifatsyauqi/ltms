import { communicationCache } from '../../utils/cache';
import { withRetry } from '../../utils/retry';
import { fetchWithTimeout } from '../../utils/fetch-timeout';
import { COMMUNICATION_CONFIG, getFeishuCredentials } from '../../communication.config';
import { FeishuTokenResponseSchema } from '../../communication.schemas';

export class FeishuAuthService {
  /**
   * Memeriksa apakah kredensial Feishu telah dikonfigurasi pada environment.
   */
  public isConfigured(): boolean {
    const creds = getFeishuCredentials();
    return creds.isConfigured;
  }

  /**
   * Mengambil Tenant Access Token dari cache atau melakukan request baru ke Feishu Open Platform.
   * STRICT NOTE: Tenant Token hanya disimpan di In-Memory Cache dengan TTL, tidak pernah di database Supabase!
   */
  public async getTenantAccessToken(): Promise<string> {
    const { appId, appSecret, baseUrl, isConfigured } = getFeishuCredentials();

    // 1. Cek In-Memory Cache
    const cachedToken = communicationCache.get<string>(COMMUNICATION_CONFIG.TOKEN_CACHE_KEY);
    if (cachedToken) {
      return cachedToken;
    }

    // 2. Validasi konfigurasi environment
    if (!isConfigured) {
      throw new Error(
        'Kredensial FEISHU_APP_ID atau FEISHU_APP_SECRET belum dikonfigurasi di Environment Variables Vercel Dashboard / .env.local.'
      );
    }

    // 3. Request ke Feishu Internal Token API dengan retry 3x dan timeout 15s
    const token = await withRetry(
      async () => {
        const response = await fetchWithTimeout(
          `${baseUrl}/auth/v3/tenant_access_token/internal`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              app_id: appId,
              app_secret: appSecret,
            }),
            timeoutMs: COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS,
          }
        );

        if (!response.ok) {
          throw new Error(`Feishu Auth HTTP Error: ${response.status} ${response.statusText}`);
        }

        const rawJson = await response.json();
        const parsed = FeishuTokenResponseSchema.safeParse(rawJson);

        if (!parsed.success) {
          throw new Error(`Feishu Auth Schema Mismatch: ${parsed.error.message}`);
        }

        const result = parsed.data;

        if (result.code !== 0 || !result.tenant_access_token) {
          throw new Error(`Feishu Auth Error [Code ${result.code}]: ${result.msg || 'Gagal mendapatkan token'}`);
        }

        // Cache token secara aman di memory (expire - buffer)
        const expireSeconds = result.expire || 7200;
        const ttl = Math.max(expireSeconds - COMMUNICATION_CONFIG.TOKEN_BUFFER_SECONDS, 60);
        communicationCache.set(COMMUNICATION_CONFIG.TOKEN_CACHE_KEY, result.tenant_access_token, ttl);

        return result.tenant_access_token;
      },
      { maxAttempts: 3, initialDelayMs: 500 }
    );

    return token;
  }
}

export const feishuAuthService = new FeishuAuthService();
