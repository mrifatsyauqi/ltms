export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  timeoutMs?: number;
}

/**
 * Menjalankan operasi async dengan mekanisme retry otomatis (default 3x) dan exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 500;
  const backoffFactor = options.backoffFactor ?? 2;
  const timeoutMs = options.timeoutMs ?? 15000;

  let attempt = 0;
  let lastError: any;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      // Timeout promise wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      return await Promise.race([fn(), timeoutPromise]);
    } catch (err: any) {
      lastError = err;
      console.warn(`[Retry] Attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);

      if (attempt < maxAttempts) {
        const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Operation failed after ${maxAttempts} attempts`);
}
