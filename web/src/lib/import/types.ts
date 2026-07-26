/** Canonical fields the rest of the system understands — must match the LongTail import payload shape (lib/data/supabase/import). */
export const CANONICAL_FIELDS = [
  'noWaybill',
  'statusTerakhir',
  'alasanBermasalah',
  'dpSampai',
  'waktuSampai',
  'sprinterDelivery',
  'cod',
  'deliveryAttempt',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const CANONICAL_FIELD_LABELS: Record<CanonicalField, string> = {
  noWaybill: 'No. Waybill',
  statusTerakhir: 'Status Terakhir',
  alasanBermasalah: 'Alasan Paket Bermasalah',
  dpSampai: 'DP Sampai',
  waktuSampai: 'Waktu Sampai',
  sprinterDelivery: 'Sprinter Delivery',
  cod: 'COD',
  deliveryAttempt: 'Delivery Attempt',
};

/** Header -> canonical field (or null if unmapped / "Abaikan kolom"). */
export type HeaderMapping = Record<string, CanonicalField | null>;

/** One parsed source file, before or after mapping is applied. */
export type ParsedFile = {
  fileName: string;
  headers: string[];
  /** Raw rows keyed by original source header. */
  rows: Record<string, unknown>[];
};

export type FileParseResult =
  | { fileName: string; ok: true; file: ParsedFile }
  | { fileName: string; ok: false; error: string };

/** A row after mapping, in the canonical shape sent to Apps Script's importLongTail. */
export type MappedRow = Partial<Record<CanonicalField, unknown>> & { noWaybill: string };
