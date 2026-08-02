import * as supa from './supabase/import';

export const previewImport = supa.previewImport;
export const importLongTail = supa.importLongTail;
export const listImportBatches = supa.listImportBatches;
export const listMappingTemplates = supa.listMappingTemplates;
export const saveMappingTemplate = supa.saveMappingTemplate;
export const deleteMappingTemplate = supa.deleteMappingTemplate;

export type { AutoClosePreview, ImportPreviewResult, ImportResult, ImportBatchRow, MappingTemplate } from './types';
