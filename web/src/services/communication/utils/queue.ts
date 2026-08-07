type Task<T> = () => Promise<T>;

/**
 * Promise Concurrency Queue
 * Mengontrol antrean pemrosesan tugas asinkron secara berurutan atau terbatas (FIFO)
 * untuk mencegah race condition atau overload saat pengguna menekan tombol berulang.
 */
export class PromiseQueue {
  private queue: Array<() => Promise<void>> = [];
  private activeCount = 0;
  private concurrency: number;

  constructor(concurrency = 1) {
    this.concurrency = concurrency;
  }

  /**
   * Menambahkan tugas ke dalam antrean dan mengembalikan Promise hasil eksekusi.
   */
  public add<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const runner = async () => {
        this.activeCount++;
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.activeCount--;
          this.next();
        }
      };

      this.queue.push(runner);
      this.next();
    });
  }

  private next(): void {
    if (this.activeCount < this.concurrency && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        nextTask();
      }
    }
  }

  public get pendingCount(): number {
    return this.queue.length;
  }

  public get isRunning(): boolean {
    return this.activeCount > 0;
  }
}

// Global queue singleton untuk pengiriman pesan komunikasi
export const communicationSendQueue = new PromiseQueue(2); // concurrency: 2
