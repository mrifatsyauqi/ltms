import * as supa from './supabase/permissions';

export const getMyMenuAccess = supa.getMyMenuAccess;

export { MENU_KEYS } from './supabase/permissions';
export type { MenuKey } from './supabase/permissions';
