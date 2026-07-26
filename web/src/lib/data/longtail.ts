import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/longtail';
import * as supa from './supabase/longtail';

export const listLongTail = USE_SUPABASE ? supa.listLongTail : sheets.listLongTail;
export const getLongTail = USE_SUPABASE ? supa.getLongTail : sheets.getLongTail;
export const submitFeedback = USE_SUPABASE ? supa.submitFeedback : sheets.submitFeedback;
export const createLongTail = USE_SUPABASE ? supa.createLongTail : sheets.createLongTail;
export const updateLongTail = USE_SUPABASE ? supa.updateLongTail : sheets.updateLongTail;
export const deleteLongTail = USE_SUPABASE ? supa.deleteLongTail : sheets.deleteLongTail;
export const previewResetLongTail = USE_SUPABASE ? supa.previewResetLongTail : sheets.previewResetLongTail;
export const resetLongTailData = USE_SUPABASE ? supa.resetLongTailData : sheets.resetLongTailData;

export type { LongTailRow, CreateLongTailInput, UpdateLongTailInput, ResetPreview, ResetResult } from '@/lib/apps-script/longtail';
