import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/riwayat-feedback';
import * as supa from './supabase/riwayat-feedback';

export const listRiwayatFeedback = USE_SUPABASE ? supa.listRiwayatFeedback : sheets.listRiwayatFeedback;

export type { RiwayatFeedbackRow } from '@/lib/apps-script/riwayat-feedback';
