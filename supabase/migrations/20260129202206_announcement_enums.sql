-- Announcement segment enum for targeted communication
-- Migration: 20260129202206_announcement_enums.sql

-- announcement_segment: Defines who receives an announcement
-- Used in announcements.target_segment to determine recipient expansion
CREATE TYPE announcement_segment AS ENUM (
  'all',          -- Everyone in community
  'owners',       -- Only owners (occupancy_type = 'owner')
  'tenants',      -- Only tenants (occupancy_type = 'tenant')
  'building',     -- Specific building(s) via target_criteria.buildings[]
  'unit_type',    -- Specific unit types via target_criteria.types[]
  'delinquent',   -- Units with outstanding balance >= target_criteria.min_balance
  'role'          -- Specific user roles via target_criteria.roles[]
);

COMMENT ON TYPE announcement_segment IS 'Targeting options for announcements: all, owners, tenants, building, unit_type, delinquent, role';
