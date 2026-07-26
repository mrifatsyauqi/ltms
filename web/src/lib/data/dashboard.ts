import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/dashboard';
import * as supa from './supabase/dashboard';

export const getDashboard = USE_SUPABASE ? supa.getDashboard : sheets.getDashboard;

export type { DashboardData, DashboardSummary, MonitoringDpRow } from '@/lib/apps-script/dashboard';
