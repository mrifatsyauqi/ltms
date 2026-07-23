import type { LongTailRow } from '@/lib/apps-script/longtail';

// Catatan: aturan warna aging (Bagian 9.1 PRD) TIDAK lagi di sini - satu-satunya
// definisi ada di <AgingBadge> / agingLevel() (components/ui/aging-badge.tsx),
// supaya badge tabel, warna baris, dan chart memakai sumber yang sama.

/** Waktu Sampai datang sebagai ISO string dari server; tampilkan DD/MM/YY. */
export function formatWaktuSampai(value: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/** Umur sebagai angka untuk sorting; non-numerik dianggap -1 supaya di bawah. */
export function umurValue(row: LongTailRow): number {
  const n = typeof row['Umur Paket'] === 'number' ? row['Umur Paket'] : Number(row['Umur Paket']);
  return Number.isFinite(n) ? n : -1;
}
