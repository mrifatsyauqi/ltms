import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/import';
import * as supa from './supabase/import';

export const importLongTail = USE_SUPABASE ? supa.importLongTail : sheets.importLongTail;
export const listImportBatches = USE_SUPABASE ? supa.listImportBatches : sheets.listImportBatches;
export const listMappingTemplates = USE_SUPABASE ? supa.listMappingTemplates : sheets.listMappingTemplates;
export const saveMappingTemplate = USE_SUPABASE ? supa.saveMappingTemplate : sheets.saveMappingTemplate;
export const deleteMappingTemplate = USE_SUPABASE ? supa.deleteMappingTemplate : sheets.deleteMappingTemplate;

export type { ImportResult, ImportBatchRow, MappingTemplate } from '@/lib/apps-script/import';
