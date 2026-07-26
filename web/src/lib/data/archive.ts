import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/archive';
import * as supa from './supabase/archive';

export const previewArchive = USE_SUPABASE ? supa.previewArchive : sheets.previewArchive;
export const runArchive = USE_SUPABASE ? supa.runArchive : sheets.runArchive;

export type { ArchivePreview, ArchiveResult } from '@/lib/apps-script/archive';
