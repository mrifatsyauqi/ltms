import * as supa from './supabase/import';

export const previewImport = supa.previewImport;
export const importLongTail = supa.importLongTail;
export const listImportBatches = supa.listImportBatches;
export const listMappingTemplates = supa.listMappingTemplates;
export const saveMappingTemplate = supa.saveMappingTemplate;
export const deleteMappingTemplate = supa.deleteMappingTemplate;
export const uploadImportBatchFiles = supa.uploadImportBatchFiles;
export const downloadImportBatchFile = supa.downloadImportBatchFile;
export const cleanupExpiredImportFiles = supa.cleanupExpiredImportFiles;
export const IMPORT_FILE_RETENTION_DAYS = supa.IMPORT_FILE_RETENTION_DAYS;

export type {
  AutoClosePreview,
  ImportPreviewResult,
  ImportResult,
  ImportBatchRow,
  ImportBatchFileRow,
  MappingTemplate,
} from './types';
