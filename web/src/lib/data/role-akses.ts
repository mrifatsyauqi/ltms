import * as supa from './supabase/role-akses';

export const listRoleAksesSummary = supa.listRoleAksesSummary;
export const listAccountsByRole = supa.listAccountsByRole;
export const getRoleDefaultPermissions = supa.getRoleDefaultPermissions;
export const setRoleDefaultPermission = supa.setRoleDefaultPermission;
export const getAccountPermissions = supa.getAccountPermissions;
export const setUserPermissionOverride = supa.setUserPermissionOverride;
export const resetUserPermissionOverride = supa.resetUserPermissionOverride;

export type {
  RoleAksesSummary,
  RoleAksesAccount,
  RoleAksesAccountDetail,
  RolePermissionRow,
  UserPermissionRow,
} from './types';
export { MENU_KEYS, GATED_ROLES, ALL_MANAGEABLE_ROLES } from './supabase/permissions';
export type { MenuKey, GatedRole, ManageableRole } from './supabase/permissions';
