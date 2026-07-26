import { USE_SUPABASE } from './backend';
import * as sheets from '@/lib/apps-script/users';
import * as supa from './supabase/users';

export const listUsers = USE_SUPABASE ? supa.listUsers : sheets.listUsers;
export const createUser = USE_SUPABASE ? supa.createUser : sheets.createUser;
export const updateUser = USE_SUPABASE ? supa.updateUser : sheets.updateUser;
export const deleteUser = USE_SUPABASE ? supa.deleteUser : sheets.deleteUser;
export const setUserPassword = USE_SUPABASE ? supa.setUserPassword : sheets.setUserPassword;

export type { UserRow, CreateUserInput, UpdateUserInput } from '@/lib/apps-script/users';
