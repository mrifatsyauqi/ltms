import { callAppsScript } from './client';
import type { MappedRow } from '@/lib/import/types';

export type ImportResult = {
  batchId: string;
  total: number;
  inserted: number;
  updated: number;
  needReview: number;
  skipped: number;
};

export type ImportBatchRow = {
  'Batch ID': string;
  Tanggal: string;
  Jam: string;
  'Admin Cabang': string;
  'Nama File': string;
  'Total Baris': number;
  Berhasil: number;
  Gagal: number;
  Status: string;
  Keterangan: string;
};

export type MappingTemplate = {
  namaTemplate: string;
  mapping: Record<string, string | null>;
  dibuatOleh: string;
  tanggal: string;
};

/** Satu file = satu panggilan (PRD Bagian 7.3: setiap file diproses independen — gagal 1 file tidak menggagalkan file lain). */
export function importLongTail(actorEmail: string, fileName: string, rows: MappedRow[]) {
  return callAppsScript<ImportResult>('importLongTail', { email: actorEmail, fileName, rows });
}

export function listImportBatches(actorEmail: string) {
  return callAppsScript<ImportBatchRow[]>('listImportBatches', { email: actorEmail });
}

export function listMappingTemplates(actorEmail: string) {
  return callAppsScript<MappingTemplate[]>('listMappingTemplates', { email: actorEmail });
}

export function saveMappingTemplate(actorEmail: string, namaTemplate: string, mapping: Record<string, string | null>) {
  return callAppsScript<{ namaTemplate: string }>('saveMappingTemplate', { email: actorEmail, data: { namaTemplate, mapping } });
}

export function deleteMappingTemplate(actorEmail: string, namaTemplate: string) {
  return callAppsScript<{ namaTemplate: string }>('deleteMappingTemplate', { email: actorEmail, namaTemplate });
}
