export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  COMMUNITY_ADMIN: 'community_admin',
  MANAGER: 'manager',
  GUARD: 'guard',
  RESIDENT: 'resident',
  PROVIDER: 'provider',
} as const;

export type SystemRole = (typeof SYSTEM_ROLES)[keyof typeof SYSTEM_ROLES];

export const ROLE_LABELS: Record<SystemRole, string> = {
  super_admin: 'Super Administrador',
  community_admin: 'Administrador',
  manager: 'Gestor',
  guard: 'Guardia',
  resident: 'Residente',
  provider: 'Proveedor',
};

export const ADMIN_ROLES: SystemRole[] = [
  SYSTEM_ROLES.SUPER_ADMIN,
  SYSTEM_ROLES.COMMUNITY_ADMIN,
  SYSTEM_ROLES.MANAGER,
];

export function isAdminRole(role: string): boolean {
  return ADMIN_ROLES.includes(role as SystemRole);
}
