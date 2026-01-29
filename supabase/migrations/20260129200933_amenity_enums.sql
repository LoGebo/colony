-- ============================================
-- AMENITY ENUMS FOR UPOE
-- Phase 5 Plan 01 Task 1: Amenity and Reservation Enums
-- ============================================
-- These enums define amenity types, booking rules, and reservation states.
-- IMPORTANT: Enum values cannot be removed in production, only added.

-- ============================================
-- AMENITY TYPE ENUM
-- ============================================
-- Types of community amenities available for booking or use

CREATE TYPE amenity_type AS ENUM (
  'pool',         -- Swimming pool
  'gym',          -- Fitness center / gymnasium
  'salon',        -- Event room / party salon
  'rooftop',      -- Rooftop terrace / lounge
  'bbq',          -- BBQ area / asador
  'court',        -- Tennis, paddle, basketball court
  'room',         -- Meeting room / business center
  'parking',      -- Guest parking spaces
  'other'         -- Other amenity types
);

COMMENT ON TYPE amenity_type IS
  'Types of community amenities. pool=swimming pool, gym=fitness center,
   salon=event/party room, rooftop=terrace, bbq=grill area, court=sports court,
   room=meeting room, parking=guest parking, other=miscellaneous.';

-- ============================================
-- RULE TYPE ENUM
-- ============================================
-- Types of booking rules for amenities
-- Each rule_type expects a specific JSONB format in rule_value

CREATE TYPE rule_type AS ENUM (
  'max_per_day',      -- Max reservations per unit per day
  'max_per_week',     -- Max reservations per unit per week
  'max_per_month',    -- Max reservations per unit per month
  'advance_min',      -- Minimum hours in advance to book
  'advance_max',      -- Maximum days in advance to book
  'duration_min',     -- Minimum duration in minutes
  'duration_max',     -- Maximum duration in minutes
  'blackout',         -- Blocked dates/times (holidays, maintenance)
  'require_deposit',  -- Requires deposit before booking
  'owner_only'        -- Only unit owners can book (not tenants)
);

COMMENT ON TYPE rule_type IS
  'Booking rule types for amenities. Expected rule_value JSONB formats:
   max_per_day: {"limit": 1}
   max_per_week: {"limit": 3}
   max_per_month: {"limit": 5}
   advance_min: {"hours": 2}
   advance_max: {"days": 30}
   duration_min: {"minutes": 30}
   duration_max: {"minutes": 180}
   blackout: {"start": "2026-12-24", "end": "2026-12-26", "reason": "Holidays"}
   require_deposit: {"amount": 500, "currency": "MXN"}
   owner_only: {} (no value needed, presence of rule enforces)';

-- ============================================
-- RESERVATION STATUS ENUM
-- ============================================
-- Lifecycle states for an amenity reservation

CREATE TYPE reservation_status AS ENUM (
  'pending',      -- Awaiting confirmation/approval
  'confirmed',    -- Approved and scheduled
  'cancelled',    -- Cancelled before completion
  'completed',    -- Successfully completed
  'no_show'       -- Reserved but did not attend
);

COMMENT ON TYPE reservation_status IS
  'Reservation lifecycle states. pending=awaiting approval, confirmed=scheduled,
   cancelled=user/admin cancelled, completed=successfully used, no_show=did not attend.';

-- ============================================
-- WAITLIST STATUS ENUM
-- ============================================
-- States for waitlist entries when desired slot is unavailable

CREATE TYPE waitlist_status AS ENUM (
  'waiting',    -- In queue waiting for slot
  'promoted',   -- Promoted to reservation (slot became available)
  'expired',    -- Waitlist entry expired (past requested time)
  'cancelled'   -- User cancelled waitlist entry
);

COMMENT ON TYPE waitlist_status IS
  'Waitlist entry states. waiting=in queue, promoted=converted to reservation when
   slot freed, expired=requested time passed, cancelled=user withdrew.';
