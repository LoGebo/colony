import { createQueryKeys, mergeQueryKeys } from '@lukemorales/query-key-factory';

export const residents = createQueryKeys('residents', {
  all: null,
  list: (communityId?: string) => [{ communityId }],
  detail: (id: string) => [id],
  byUnit: (unitId: string) => [{ unitId }],
});

export const visitors = createQueryKeys('visitors', {
  all: null,
  list: (filters?: Record<string, unknown>) => [{ filters }],
  active: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
});

export const payments = createQueryKeys('payments', {
  all: null,
  byUnit: (unitId: string) => [{ unitId }],
  balance: (unitId: string) => [{ unitId }],
});

export const accessLogs = createQueryKeys('access-logs', {
  all: null,
  recent: (accessPointId: string) => [{ accessPointId }],
  today: (communityId: string) => [{ communityId }],
});

export const amenities = createQueryKeys('amenities', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  reservations: (amenityId: string, date?: string) => [{ amenityId, date }],
});

export const notifications = createQueryKeys('notifications', {
  all: null,
  unread: (userId: string) => [{ userId }],
});

export const kpis = createQueryKeys('kpis', {
  all: null,
  summary: (communityId: string, period: string) => [{ communityId, period }],
});

export const communities = createQueryKeys('communities', {
  all: null,
  detail: (id: string) => [id],
  settings: (id: string) => [{ id }],
});

export const units = createQueryKeys('units', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
});

export const guards = createQueryKeys('guards', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
});

export const queryKeys = mergeQueryKeys(
  residents,
  visitors,
  payments,
  accessLogs,
  amenities,
  notifications,
  kpis,
  communities,
  units,
  guards,
);
