import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { SYSTEM_ROLES } from '@upoe/shared';

/**
 * Role check hook for mobile.
 * Provides boolean helpers for role-based UI rendering and access control.
 */
export function useRole() {
  const { role } = useAuth();

  return useMemo(() => {
    const isResident = role === SYSTEM_ROLES.RESIDENT;
    const isGuard = role === SYSTEM_ROLES.GUARD;
    const isAdmin = role === SYSTEM_ROLES.COMMUNITY_ADMIN;
    const isManager = role === SYSTEM_ROLES.MANAGER;
    const isSuperAdmin = role === SYSTEM_ROLES.SUPER_ADMIN;
    const isPendingSetup = role === 'pending_setup';
    const isAdminRole = isAdmin || isManager || isSuperAdmin;

    return {
      role,
      isResident,
      isGuard,
      isAdmin,
      isManager,
      isSuperAdmin,
      isPendingSetup,
      isAdminRole,
    };
  }, [role]);
}
