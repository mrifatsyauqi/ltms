import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/master-feedback';
import * as supa from './supabase/master-feedback';

export const listMasterFeedback = USE_SUPABASE ? supa.listMasterFeedback : sheets.listMasterFeedback;
export const createMasterFeedback = USE_SUPABASE ? supa.createMasterFeedback : sheets.createMasterFeedback;
export const updateMasterFeedback = USE_SUPABASE ? supa.updateMasterFeedback : sheets.updateMasterFeedback;
export const deleteMasterFeedback = USE_SUPABASE ? supa.deleteMasterFeedback : sheets.deleteMasterFeedback;

export type { MasterFeedbackRow } from '@/lib/apps-script/master-feedback';
