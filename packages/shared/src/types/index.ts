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
