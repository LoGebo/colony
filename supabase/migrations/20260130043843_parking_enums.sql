-- ============================================
-- PARKING ENUM TYPES
-- Phase 8 Plan 04 Task 1: Parking Enums
-- ============================================
-- Enum types for parking spot classification and operational status.
-- These enums support parking inventory management with spot types
-- and real-time status tracking.

-- ============================================
-- PARKING SPOT TYPE ENUM
-- ============================================
-- Classification of parking spots by purpose/assignment

CREATE TYPE parking_spot_type AS ENUM (
  'assigned',    -- Belongs to specific unit (permanent assignment)
  'visitor',     -- For guests, first-come or reservation-based
  'commercial',  -- For commercial units/businesses
  'disabled',    -- Accessible parking (ADA/NOM-030 compliant)
  'loading',     -- Loading/unloading zone (time-limited)
  'reserved'     -- Reserved for specific purpose (admin, emergency, maintenance)
);

COMMENT ON TYPE parking_spot_type IS
  'Classification of parking spots by purpose.
   - assigned: Permanently assigned to a unit
   - visitor: For guest vehicles (may require reservation)
   - commercial: Designated for commercial tenants
   - disabled: Accessible parking spaces
   - loading: Temporary loading/unloading zones
   - reserved: Special purpose (emergency, admin)';

-- ============================================
-- PARKING SPOT STATUS ENUM
-- ============================================
-- Real-time operational status of parking spots

CREATE TYPE parking_spot_status AS ENUM (
  'available',   -- Ready for use
  'occupied',    -- Currently in use
  'reserved',    -- Reserved for upcoming use
  'maintenance', -- Under maintenance/repair
  'blocked'      -- Temporarily blocked (event, construction)
);

COMMENT ON TYPE parking_spot_status IS
  'Real-time operational status of a parking spot.
   - available: Empty and ready for use
   - occupied: Currently has a vehicle
   - reserved: Reserved for future use (visitor reservation)
   - maintenance: Under repair or cleaning
   - blocked: Temporarily out of service';

-- ============================================
-- PARKING VIOLATION TYPE ENUM
-- ============================================
-- Types of parking violations

CREATE TYPE parking_violation_type AS ENUM (
  'unauthorized_parking', -- Parking in wrong spot or without permission
  'double_parking',       -- Blocking other vehicles
  'blocking',             -- Blocking access (driveway, fire lane, exit)
  'overstay',             -- Exceeding time limit (visitor spots)
  'wrong_spot',           -- Assigned vehicle in wrong spot
  'other'                 -- Other violations
);

COMMENT ON TYPE parking_violation_type IS
  'Types of parking violations for enforcement tracking.
   Used in parking_violations table to categorize incidents.';

-- ============================================
-- PARKING VIOLATION STATUS ENUM
-- ============================================
-- Resolution workflow for parking violations

CREATE TYPE parking_violation_status AS ENUM (
  'reported',   -- Initial report, awaiting review
  'warned',     -- Warning issued to vehicle owner
  'fined',      -- Fine/penalty applied
  'resolved',   -- Issue resolved (vehicle moved, fine paid)
  'dismissed'   -- Violation dismissed (invalid report, etc.)
);

COMMENT ON TYPE parking_violation_status IS
  'Resolution workflow status for parking violations.
   Typical flow: reported -> warned -> fined -> resolved
   or: reported -> dismissed (if invalid)';

-- ============================================
-- PARKING ASSIGNMENT TYPE ENUM
-- ============================================
-- Type of parking spot assignment

CREATE TYPE parking_assignment_type AS ENUM (
  'ownership',  -- Permanent ownership with unit
  'rental',     -- Renting spot from owner/community
  'temporary'   -- Short-term assignment (visitor, event)
);

COMMENT ON TYPE parking_assignment_type IS
  'Type of parking spot assignment to a unit.
   - ownership: Spot is part of unit deed/purchase
   - rental: Spot rented separately from unit
   - temporary: Short-term assignment (construction, event)';

-- ============================================
-- PARKING RESERVATION STATUS ENUM
-- ============================================
-- Status workflow for visitor parking reservations

CREATE TYPE parking_reservation_status AS ENUM (
  'pending',    -- Awaiting confirmation
  'confirmed',  -- Confirmed, spot reserved
  'cancelled',  -- Cancelled by resident
  'completed',  -- Visitor checked out
  'no_show'     -- Visitor never arrived
);

COMMENT ON TYPE parking_reservation_status IS
  'Status workflow for visitor parking reservations.
   Only confirmed reservations participate in exclusion constraint.';
