-- ============================================
-- INVITATION TYPE ENUM
-- ============================================
-- Types of visitor invitations with different validation rules
-- Part of Phase 3 Plan 02: Invitations & Access Management

-- Invitation types for visitor access
CREATE TYPE invitation_type AS ENUM (
  'single_use',     -- One-time entry, burns after use
  'event',          -- Valid for specific date/time window (party, meeting)
  'recurring',      -- Regular visits (housekeeper, trainer, nurse)
  'vehicle_preauth' -- Pre-authorized vehicle by plate (delivery, Uber)
);

COMMENT ON TYPE invitation_type IS 'Types of visitor invitations with different validation rules';
