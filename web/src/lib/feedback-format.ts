import type { LongTailRow } from '@/lib/data/longtail';

// Catatan: aturan warna aging (Bagian 9.1 PRD) TIDAK lagi di sini - satu-satunya
// definisi ada di <AgingBadge> / agingLevel() (components/ui/aging-badge.tsx),
// supaya badge tabel, warna baris, dan chart memakai sumber yang sama.

/**
 * Waktu Sampai dari Excel disimpan apa adanya, mis. "2026-07-04 18:34:49".
 * Tampilkan tanggal + jam: "04/07/26 18:34:49". Diekstrak dari string agar jam
 * tidak bergeser oleh timezone. Nilai ISO ber-zona (…Z / +07:00) di-fallback ke
 * Date lokal; kalau tanpa jam, tampilkan tanggal saja.
 */
export function formatWaktuSampai(value: string): string {
  if (!value) return '';
  const s = String(value).trim();
  const zoned = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);

  const dt = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (dt && !zoned) {
    const [, yyyy, mo, dd, hh, mi, ss] = dt;
    return `${dd}/${mo}/${yyyy.slice(-2)} ${hh}:${mi}${ss ? `:${ss}` : ''}`;
  }

  const dOnly = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dOnly) {
    const [, yyyy, mo, dd] = dOnly;
    return `${dd}/${mo}/${yyyy.slice(-2)}`;
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  const hasTime = d.getHours() || d.getMinutes() || d.getSeconds();
  return hasTime ? `${base} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}` : base;
}

/** Umur sebagai angka untuk sorting; non-numerik dianggap -1 supaya di bawah. */
export function umurValue(row: LongTailRow): number {
  const n = typeof row['Umur Paket'] === 'number' ? row['Umur Paket'] : Number(row['Umur Paket']);
  return Number.isFinite(n) ? n : -1;
}
