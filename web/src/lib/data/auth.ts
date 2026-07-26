import * as supa from './supabase/auth';

export const getUserByEmail = supa.getUserByEmail;
export const verifyCredentials = supa.verifyCredentials;

export type { AuthUser, CredentialsUser } from './types';
