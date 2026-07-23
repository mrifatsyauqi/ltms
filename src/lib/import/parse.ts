import * as XLSX from 'xlsx';
import type { FileParseResult } from './types';

/**
 * Parses one Excel/CSV file client-side via SheetJS (PRD Bagian 4: "SheetJS
 * untuk parsing file Excel di client"). Each file is independent — a parse
 * failure here (corrupt file, no rows) must not affect other files in the
 * same multi-upload batch (Bagian 7.3 partial failure).
 */
export async function parseFile(file: File): Promise<FileParseResult> {
  try {
    const buffer = await file.arrayBuffer();
    // cellDates: true — export JMS asli menyimpan tanggal sebagai Excel serial
    // number (mis. 46223.21...), bukan teks. Tanpa opsi ini SheetJS
    // mengembalikan angka mentah, dan kalau nanti angka itu ditulis sebagai
    // string ke Google Sheets bisa salah tafsir DD/MM vs MM/DD. Dengan
    // cellDates:true, sel bertipe tanggal dikonversi ke objek Date asli.
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { fileName: file.name, ok: false, error: 'File tidak punya sheet apa pun' };
    }
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) {
      return { fileName: file.name, ok: false, error: 'Sheet kosong / tidak ada baris data' };
    }
    const headers = Object.keys(rows[0]);
    return { fileName: file.name, ok: true, file: { fileName: file.name, headers, rows } };
  } catch (err) {
    return { fileName: file.name, ok: false, error: err instanceof Error ? err.message : 'Gagal membaca file' };
  }
}

export async function parseFiles(files: File[]): Promise<FileParseResult[]> {
  return Promise.all(files.map(parseFile));
}
