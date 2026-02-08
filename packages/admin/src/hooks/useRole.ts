'use client';

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { SYSTEM_ROLES } from '@upoe/shared';

/**
 * Role check hook for admin dashboard.
 * Same API shape as mobile useRole for cross-platform consistency.
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
