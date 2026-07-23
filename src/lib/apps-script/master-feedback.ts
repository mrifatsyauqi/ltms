import { callAppsScript } from './client';

export type MasterFeedbackRow = {
  ID: number;
  'Nama Feedback': string;
  'Status Aktif': string;
};

export function listMasterFeedback(actorEmail: string) {
  return callAppsScript<MasterFeedbackRow[]>('listMasterFeedback', { email: actorEmail });
}

export function createMasterFeedback(actorEmail: string, namaFeedback: string) {
  return callAppsScript<{ id: number }>('createMasterFeedback', { email: actorEmail, data: { namaFeedback } });
}

export function updateMasterFeedback(
  actorEmail: string,
  id: number | string,
  data: Partial<{ namaFeedback: string; statusAktif: boolean }>,
) {
  return callAppsScript<MasterFeedbackRow>('updateMasterFeedback', { email: actorEmail, id, data });
}

export function deleteMasterFeedback(actorEmail: string, id: number | string) {
  return callAppsScript<{ id: number | string }>('deleteMasterFeedback', { email: actorEmail, id });
}
