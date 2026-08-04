interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

export class MemoryCache {
  private store = new Map<string, CacheItem<any>>();

  /**
   * Menyimpan item ke cache dengan durasi TTL (Time-To-Live dalam detik).
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Mengambil item dari cache jika belum kedaluwarsa.
   */
  get<T>(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return item.value as T;
  }

  /**
   * Menghapus cache berdasarkan key tertentu.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Membersihkan seluruh isi cache.
   */
  clear(): void {
    this.store.clear();
  }
}

// Singleton in-memory cache instance
export const communicationCache = new MemoryCache();
