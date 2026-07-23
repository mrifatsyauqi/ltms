import { callAppsScript } from './client';

export type UserRow = {
  Nama: string;
  Email: string;
  Role: string;
  'Drop Point': string;
  'Status Aktif': string;
};

export type CreateUserInput = {
  nama: string;
  email: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint?: string;
};

export type UpdateUserInput = Partial<{
  nama: string;
  role: 'Admin Cabang' | 'Admin DP';
  dropPoint: string;
  statusAktif: boolean;
}>;

export function listUsers(actorEmail: string) {
  return callAppsScript<UserRow[]>('listUsers', { email: actorEmail });
}

export function createUser(actorEmail: string, data: CreateUserInput) {
  return callAppsScript<{ email: string }>('createUser', { email: actorEmail, data });
}

export function updateUser(actorEmail: string, targetEmail: string, data: UpdateUserInput) {
  return callAppsScript<UserRow>('updateUser', { email: actorEmail, targetEmail, data });
}
