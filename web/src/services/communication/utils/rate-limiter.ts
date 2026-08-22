import { COMMUNICATION_CONFIG } from '../communication.config';

interface RateLimitRecord {
  timestamps: number[];
}

/**
 * Sliding-Window In-Memory Rate Limiter
 * Membatasi maksimal N request per interval waktu untuk mencegah spam pengiriman.
 */
export class SlidingWindowRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(
    maxRequests: number = COMMUNICATION_CONFIG.RATE_LIMIT.MAX_REQUESTS,
    windowMs: number = COMMUNICATION_CONFIG.RATE_LIMIT.WINDOW_MS
  ) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Memeriksa apakah identifier (misal user email atau IP) diizinkan melakukan request.
   * Mengembalikan object { allowed: boolean, remaining: number, resetInMs: number }
   */
  public check(key: string): {
    allowed: boolean;
    remaining: number;
    resetInMs: number;
  } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    // Buang timestamp yang sudah di luar window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0];
      const resetInMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetInMs,
      };
    }

    // Catat request baru
    record.timestamps.push(now);
    const remaining = this.maxRequests - record.timestamps.length;
    const resetInMs = this.windowMs;

    return {
      allowed: true,
      remaining,
      resetInMs,
    };
  }

  /**
   * Reset data limiter untuk testing atau admin
   */
  public clear(): void {
    this.records.clear();
  }
}

export const communicationRateLimiter = new SlidingWindowRateLimiter();
