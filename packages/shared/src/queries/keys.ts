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
  detail: (id: string) => [id],
  reservations: (amenityId: string, date?: string) => [{ amenityId, date }],
  myReservations: (residentId: string) => [{ residentId }],
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

export const packages = createQueryKeys('packages', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  pending: (communityId: string) => [{ communityId }],
});

export const occupancies = createQueryKeys('occupancies', {
  all: null,
  byResident: (residentId: string) => [{ residentId }],
});

export const shifts = createQueryKeys('shifts', {
  all: null,
  current: (guardId: string) => [{ guardId }],
});

export const tickets = createQueryKeys('tickets', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  comments: (ticketId: string) => [{ ticketId }],
  slaMetrics: (communityId: string) => [{ communityId }],
});

export const announcements = createQueryKeys('announcements', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  recipients: (announcementId: string) => [{ announcementId }],
  feed: (residentId: string) => [{ residentId }],
});

export const documents = createQueryKeys('documents', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  versions: (documentId: string) => [{ documentId }],
});

export const posts = createQueryKeys('posts', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  comments: (postId: string) => [{ postId }],
});

export const marketplace = createQueryKeys('marketplace', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  myListings: (residentId: string) => [{ residentId }],
});

export const vehicles = createQueryKeys('vehicles', {
  all: null,
  list: (residentId: string) => [{ residentId }],
  detail: (id: string) => [id],
});

export const elections = createQueryKeys('elections', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  results: (id: string) => [{ id }],
});

export const patrols = createQueryKeys('patrols', {
  all: null,
  routes: (communityId: string) => [{ communityId }],
  routeDetail: (id: string) => [id],
  activeLogs: (guardId: string) => [{ guardId }],
  logDetail: (id: string) => [id],
  checkpoints: (communityId: string) => [{ communityId }],
});

export const incidents = createQueryKeys('incidents', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  types: (communityId: string) => [{ communityId }],
  media: (incidentId: string) => [{ incidentId }],
});

export const emergencies = createQueryKeys('emergencies', {
  all: null,
  active: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
});

export const handovers = createQueryKeys('handovers', {
  all: null,
  recent: (communityId: string) => [{ communityId }],
  unacknowledged: (communityId: string) => [{ communityId }],
});

export const providers = createQueryKeys('providers', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  documents: (providerId: string) => [{ providerId }],
  personnel: (providerId: string) => [{ providerId }],
  schedules: (providerId: string) => [{ providerId }],
  expiringDocs: (communityId: string) => [{ communityId }],
});

export const workOrders = createQueryKeys('work-orders', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  byProvider: (providerId: string) => [{ providerId }],
});

export const parking = createQueryKeys('parking', {
  all: null,
  spots: (communityId: string) => [{ communityId }],
  assignments: (communityId: string) => [{ communityId }],
  reservations: (communityId: string) => [{ communityId }],
  violations: (communityId: string) => [{ communityId }],
});

export const moves = createQueryKeys('moves', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  validations: (moveId: string) => [{ moveId }],
  deposits: (communityId: string) => [{ communityId }],
});

export const moderation = createQueryKeys('moderation', {
  all: null,
  queue: (communityId: string) => [{ communityId }],
  stats: (communityId: string) => [{ communityId }],
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
  packages,
  occupancies,
  shifts,
  tickets,
  announcements,
  documents,
  posts,
  marketplace,
  vehicles,
  elections,
  patrols,
  incidents,
  emergencies,
  handovers,
  providers,
  workOrders,
  parking,
  moves,
  moderation,
);
