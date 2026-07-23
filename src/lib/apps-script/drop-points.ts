import { callAppsScript } from './client';

export type DropPointRow = {
  'Kode DP': string;
  'Nama DP': string;
  'Wilayah/Cabang': string;
  'Status Aktif': string;
};

export type CreateDropPointInput = {
  kodeDp: string;
  namaDp: string;
  wilayah?: string;
};

export type UpdateDropPointInput = Partial<{
  namaDp: string;
  wilayah: string;
  statusAktif: boolean;
}>;

export function listDropPoints(actorEmail: string) {
  return callAppsScript<DropPointRow[]>('listDropPoints', { email: actorEmail });
}

export function createDropPoint(actorEmail: string, data: CreateDropPointInput) {
  return callAppsScript<{ kodeDp: string }>('createDropPoint', { email: actorEmail, data });
}

export function updateDropPoint(actorEmail: string, kodeDp: string, data: UpdateDropPointInput) {
  return callAppsScript<DropPointRow>('updateDropPoint', { email: actorEmail, kodeDp, data });
}

export function deleteDropPoint(actorEmail: string, kodeDp: string) {
  return callAppsScript<{ kodeDp: string }>('deleteDropPoint', { email: actorEmail, kodeDp });
}
