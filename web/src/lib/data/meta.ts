import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/meta';
import * as supa from './supabase/meta';

export const getLastUpdate = USE_SUPABASE ? supa.getLastUpdate : sheets.getLastUpdate;

export type { LastUpdate } from '@/lib/apps-script/meta';
