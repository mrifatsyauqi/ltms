import type { HeaderMapping, MappedRow, ParsedFile } from './types';

/** Applies a header mapping to a parsed file's raw rows. Rows with no waybill after mapping are dropped (can't dedup/import without a key). */
export function applyMapping(file: ParsedFile, mapping: HeaderMapping): MappedRow[] {
  const result: MappedRow[] = [];
  for (const rawRow of file.rows) {
    const mapped: Partial<MappedRow> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (!field) continue;
      const value = rawRow[header];
      (mapped as Record<string, unknown>)[field] = value;
    }
    const noWaybill = String(mapped.noWaybill ?? '').trim();
    if (!noWaybill) continue;
    result.push({ ...mapped, noWaybill } as MappedRow);
  }
  return result;
}

/**
 * Merge Data + Remove Duplicate berdasarkan Waybill (PRD Bagian 6/7) — dalam
 * SATU batch upload (lintas file yang diupload bersamaan), bukan lintas batch
 * (itu urusan server di Bagian 7.1). Baris belakangan (file/urutan lebih akhir)
 * menang untuk waybill yang sama — asumsi: file yang diupload lebih akhir
 * dianggap data lebih baru.
 */
export function mergeAndDedup(rowsPerFile: MappedRow[][]): { rows: MappedRow[]; duplicateCount: number } {
  const byWaybill = new Map<string, MappedRow>();
  let duplicateCount = 0;

  for (const rows of rowsPerFile) {
    for (const row of rows) {
      const key = row.noWaybill.trim().toLowerCase();
      if (byWaybill.has(key)) duplicateCount++;
      byWaybill.set(key, row);
    }
  }

  return { rows: Array.from(byWaybill.values()), duplicateCount };
}
