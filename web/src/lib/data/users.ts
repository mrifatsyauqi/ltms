import * as supa from './supabase/users';

export const listUsers = supa.listUsers;
export const createUser = supa.createUser;
export const updateUser = supa.updateUser;
export const deleteUser = supa.deleteUser;
export const setUserPassword = supa.setUserPassword;
export const createGeneralAccount = supa.createGeneralAccount;

export type { UserRow, CreateUserInput, UpdateUserInput, CreateGeneralAccountResult } from './types';
