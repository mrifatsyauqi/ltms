import * as supa from './supabase/longtail';

export const listLongTail = supa.listLongTail;
export const getLongTail = supa.getLongTail;
export const submitFeedback = supa.submitFeedback;
export const createLongTail = supa.createLongTail;
export const updateLongTail = supa.updateLongTail;
export const deleteLongTail = supa.deleteLongTail;
export const previewResetLongTail = supa.previewResetLongTail;
export const resetLongTailData = supa.resetLongTailData;

export type { LongTailRow, CreateLongTailInput, UpdateLongTailInput, ResetPreview, ResetResult } from './types';
