import { callAppsScript } from './client';

export type FavoriteFeedbackRow = {
  'Email Admin DP': string;
  'Nama Feedback': string;
  Urutan: number;
};

/** Selalu di-scope ke email aktor sendiri di sisi Apps Script (Bagian 11 PRD). */
export function listFavoriteFeedback(actorEmail: string) {
  return callAppsScript<FavoriteFeedbackRow[]>('listFavoriteFeedback', { email: actorEmail });
}

export function addFavoriteFeedback(actorEmail: string, namaFeedback: string) {
  return callAppsScript<{ namaFeedback: string }>('addFavoriteFeedback', { email: actorEmail, data: { namaFeedback } });
}

export function removeFavoriteFeedback(actorEmail: string, namaFeedback: string) {
  return callAppsScript<{ namaFeedback: string }>('removeFavoriteFeedback', { email: actorEmail, namaFeedback });
}
