import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/dashboard';
import * as supa from './supabase/dashboard';

export const getDashboard = USE_SUPABASE ? supa.getDashboard : sheets.getDashboard;

// Snapshot historis (v1.3) — fitur khusus Supabase; tidak ada padanan di Sheets.
export const getDashboardSnapshot = supa.getDashboardSnapshot;
export const writeDailySnapshot = supa.writeDailySnapshot;

export type { DashboardData, DashboardSummary, MonitoringDpRow } from '@/lib/apps-script/dashboard';
