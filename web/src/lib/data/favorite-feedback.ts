import * as supa from './supabase/favorite-feedback';

export const listFavoriteFeedback = supa.listFavoriteFeedback;
export const addFavoriteFeedback = supa.addFavoriteFeedback;
export const removeFavoriteFeedback = supa.removeFavoriteFeedback;

export type { FavoriteFeedbackRow } from './types';
