/**
 * staleTime utk query yang jarang berubah (drop-points, master-feedback,
 * users, favorite-feedback) - lebih panjang dari default global 30 detik
 * (lihat providers.tsx) karena data referensi/master ini tidak perlu
 * se-live data operasional (dashboard/longtail).
 */
export const SLOW_STALE_TIME = 5 * 60 * 1000;
