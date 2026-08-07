import { COMMUNICATION_CONFIG } from '../communication.config';

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
}

/**
 * Fetch wrapper dengan dukungan AbortController timeout 15 detik (atau custom).
 * Mencegah request menggantung jika jaringan lambat atau Feishu API tidak merespons.
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeoutMs = COMMUNICATION_CONFIG.DEFAULT_TIMEOUT_MS, ...fetchInit } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return response;
  } catch (err: any) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      throw new Error(`Request Timeout: Gagal menghubungi Feishu API dalam batas ${timeoutMs / 1000} detik.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
