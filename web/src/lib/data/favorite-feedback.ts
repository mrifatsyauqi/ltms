import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/favorite-feedback';
import * as supa from './supabase/favorite-feedback';

export const listFavoriteFeedback = USE_SUPABASE ? supa.listFavoriteFeedback : sheets.listFavoriteFeedback;
export const addFavoriteFeedback = USE_SUPABASE ? supa.addFavoriteFeedback : sheets.addFavoriteFeedback;
export const removeFavoriteFeedback = USE_SUPABASE ? supa.removeFavoriteFeedback : sheets.removeFavoriteFeedback;

export type { FavoriteFeedbackRow } from '@/lib/apps-script/favorite-feedback';
