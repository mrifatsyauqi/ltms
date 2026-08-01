import * as supa from './supabase/permissions';

export const getMyMenuAccess = supa.getMyMenuAccess;

export { MENU_KEYS, GATED_ROLES, isGatedRole } from './supabase/permissions';
export type { MenuKey, GatedRole } from './supabase/permissions';
