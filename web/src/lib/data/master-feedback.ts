import * as supa from './supabase/master-feedback';

export const listMasterFeedback = supa.listMasterFeedback;
export const createMasterFeedback = supa.createMasterFeedback;
export const updateMasterFeedback = supa.updateMasterFeedback;
export const deleteMasterFeedback = supa.deleteMasterFeedback;

export type { MasterFeedbackRow } from './types';
