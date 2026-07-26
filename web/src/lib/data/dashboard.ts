import * as supa from './supabase/dashboard';

export const getDashboard = supa.getDashboard;
export const getDashboardSnapshot = supa.getDashboardSnapshot;
export const writeDailySnapshot = supa.writeDailySnapshot;

export type { DashboardData, DashboardSummary, MonitoringDpRow } from './types';
