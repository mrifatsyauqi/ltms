/**
 * Facade domain Drop Point: pilih implementasi Supabase atau Sheets sesuai
 * flag DATA_BACKEND. API route mengimpor dari sini (bukan langsung ke salah
 * satu implementasi), jadi cutover cukup lewat env var.
 */
import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/drop-points';
import * as supa from './supabase/drop-points';

export const listDropPoints = USE_SUPABASE ? supa.listDropPoints : sheets.listDropPoints;
export const createDropPoint = USE_SUPABASE ? supa.createDropPoint : sheets.createDropPoint;
export const updateDropPoint = USE_SUPABASE ? supa.updateDropPoint : sheets.updateDropPoint;
export const deleteDropPoint = USE_SUPABASE ? supa.deleteDropPoint : sheets.deleteDropPoint;

export type {
  DropPointRow,
  CreateDropPointInput,
  UpdateDropPointInput,
} from '@/lib/apps-script/drop-points';
