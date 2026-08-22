/**
 * Konfigurasi Komunikasi & Feishu Open Platform
 * Seluruh endpoint menggunakan konfigurasi terpusat dan tidak di-hardcode.
 */

export const COMMUNICATION_CONFIG = {
  // Base URL Feishu Open Platform (default resmi: https://open.feishu.cn/open-apis)
  FEISHU_API_BASE_URL: (
    process.env.FEISHU_API_BASE_URL || 'https://open.feishu.cn/open-apis'
  ).replace(/\/+$/, ''),

  // Feishu App Credentials
  FEISHU_APP_ID: (process.env.FEISHU_APP_ID || '').trim(),
  FEISHU_APP_SECRET: (process.env.FEISHU_APP_SECRET || '').trim(),

  // Request Timeouts
  DEFAULT_TIMEOUT_MS: 15_000, // 15 detik sesuai spesifikasi AbortController

  // Rate Limiting Config
  RATE_LIMIT: {
    MAX_REQUESTS: 5,
    WINDOW_MS: 10_000, // 5 request per 10 detik per user
  },

  // Token Cache TTL
  TOKEN_CACHE_KEY: 'feishu_tenant_access_token',
  TOKEN_BUFFER_SECONDS: 300, // Buffer 5 menit sebelum expire

  // Bablast API Config
  BABLAST_API_URL: (process.env.BABLAST_API_URL || 'https://api.bablast.id').replace(/\/+$/, ''),
  BABLAST_API_KEY: (process.env.BABLAST_API_KEY || '').trim(),
  BABLAST_SENDER_ID: (process.env.BABLAST_SENDER_ID || '').trim(),
} as const;

export function getFeishuCredentials() {
  const appId = (process.env.FEISHU_APP_ID || '').trim();
  const appSecret = (process.env.FEISHU_APP_SECRET || '').trim();
  const baseUrl = (
    process.env.FEISHU_API_BASE_URL || 'https://open.feishu.cn/open-apis'
  ).replace(/\/+$/, '');

  return {
    appId,
    appSecret,
    baseUrl,
    isConfigured: Boolean(appId && appSecret),
  };
}

export function getBablastCredentials() {
  const apiKey = COMMUNICATION_CONFIG.BABLAST_API_KEY;
  const baseUrl = COMMUNICATION_CONFIG.BABLAST_API_URL;
  const senderId = COMMUNICATION_CONFIG.BABLAST_SENDER_ID;
  
  return {
    apiKey,
    baseUrl,
    senderId,
    isConfigured: Boolean(apiKey),
  };
}
