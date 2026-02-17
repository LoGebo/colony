export type { Database, Json } from './database.types';
import type { Database } from './database.types';

// Convenience type aliases for common tables
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Common entity types
export type Organization = Tables<'organizations'>;
export type Community = Tables<'communities'>;
export type Unit = Tables<'units'>;
export type Resident = Tables<'residents'>;
export type Guard = Tables<'guards'>;
export type AccessPoint = Tables<'access_points'>;
export type Occupancy = Tables<'occupancies'>;
export type Notification = Tables<'notifications'>;
export type PushToken = Tables<'push_tokens'>;

// Additional entity type convenience aliases
export type Ticket = Tables<'tickets'>;
export type Incident = Tables<'incidents'>;
export type Election = Tables<'elections'>;
export type Assembly = Tables<'assemblies'>;
export type Violation = Tables<'violations'>;
export type ViolationType = Tables<'violation_types'>;
export type Announcement = Tables<'announcements'>;
export type Post = Tables<'posts'>;
export type PostComment = Tables<'post_comments'>;
export type Document = Tables<'documents'>;
export type MarketplaceListing = Tables<'marketplace_listings'>;
export type Pet = Tables<'pets'>;
export type Vehicle = Tables<'vehicles'>;
export type Invitation = Tables<'invitations'>;
export type Package = Tables<'packages'>;
export type Amenity = Tables<'amenities'>;
export type Reservation = Tables<'reservations'>;
export type Parking = Tables<'parking_spots'>;
export type MoveRequest = Tables<'move_requests'>;
export type Provider = Tables<'providers'>;
export type Transaction = Tables<'transactions'>;
export type PaymentProof = Tables<'payment_proofs'>;
export type FeeStructure = Tables<'fee_structures'>;
export type GuardShift = Tables<'guard_shifts'>;
export type PatrolRoute = Tables<'patrol_routes'>;
export type Account = Tables<'accounts'>;

// Auth-related types
export interface AppMetadata {
  community_id?: string;
  role?: string;
  resident_id?: string;
  guard_id?: string;
  organization_id?: string;
  onboarding_complete?: boolean;
}

export interface UserSession {
  id: string;
  email: string;
  appMetadata: AppMetadata;
}
