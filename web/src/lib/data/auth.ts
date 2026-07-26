import { USE_SUPABASE } from './backend';
import { getUserByEmail as sheetsGetUserByEmail } from '@/lib/apps-script';
import { verifyCredentials as sheetsVerifyCredentials } from '@/lib/apps-script/users';
import * as supa from './supabase/auth';

export const getUserByEmail = USE_SUPABASE ? supa.getUserByEmail : sheetsGetUserByEmail;
export const verifyCredentials = USE_SUPABASE ? supa.verifyCredentials : sheetsVerifyCredentials;

export type { AppsScriptUser } from '@/lib/apps-script';
export type { CredentialsUser } from '@/lib/apps-script/users';
