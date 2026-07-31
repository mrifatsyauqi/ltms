import * as XLSX from 'xlsx';
import type { LongTailRow } from '@/lib/data/longtail';
import { formatWaktuSampai } from '@/lib/feedback-format';

// Label header sesuai spesifikasi (BUKAN label kolom tabel UI apa adanya -
// beberapa disingkat di layar, mis. 'Sprinter' -> 'Sprinter Delivery' di
// sini). Umur/Status Umur SENGAJA tidak ada - Umur tetap filter, bukan kolom.
const HEADERS = [
  'No. Waybill',
  'Status Terakhir',
  'Alasan Bermasalah',
  'DP',
  'Waktu Sampai',
  'Sprinter Delivery',
  'COD',
  'Attempt',
  'Feedback',
] as const;

function toSheetRow(r: LongTailRow): Record<(typeof HEADERS)[number], string | number> {
  return {
    'No. Waybill': r['No. Waybill'],
    'Status Terakhir': r['Status Terakhir'],
    'Alasan Bermasalah': r['Alasan Paket Bermasalah'],
    DP: r['DP Sampai'],
    // Reuse formatter yang sama dgn kolom tabel UI (dd/mm/yy hh:mm[:ss]) -
    // bukan format baru, supaya konsisten dgn yg terlihat di layar.
    'Waktu Sampai': formatWaktuSampai(String(r['Waktu Sampai'] ?? '')),
    'Sprinter Delivery': r['Sprinter Delivery'],
    COD: r.COD,
    Attempt: r['Delivery Attempt'],
    Feedback: r.Feedback,
  };
}

/** Tanggal hari ini di Jakarta (UTC+7) sbg 'YYYY-MM-DD' - utk nama file. */
function todayJakartaIso(): string {
  const j = new Date(Date.now() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${j.getUTCFullYear()}-${p(j.getUTCMonth() + 1)}-${p(j.getUTCDate())}`;
}

/**
 * Generate & unduh file Excel Data Long Tail di browser - reuse `xlsx`
 * (SheetJS) yang sudah dipakai utk parsing di halaman Import & Monitoring
 * Delivery, tidak nambah dependency baru. `rows` HARUS sudah berisi SEMUA
 * baris yg cocok filter aktif (caller: FeedbackTable pakai
 * table.getFilteredRowModel(), sudah mencakup search+filter lain, TIDAK
 * dibatasi pagination client - lihat komentar di pemanggilnya).
 */
export function downloadLongTailExcel(rows: LongTailRow[], cakupanLabel: string) {
  const sheet = XLSX.utils.json_to_sheet(rows.map(toSheetRow), { header: [...HEADERS] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data Long Tail');
  const safeCakupan = cakupanLabel.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(workbook, `LongTail_${safeCakupan}_${todayJakartaIso()}.xlsx`);
}
