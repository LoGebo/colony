-- ============================================
-- VIOLATION ENUM TYPES
-- ============================================
-- Phase 8 Plan 07: Violation Tracking
--
-- Defines severity levels and sanction types for
-- violation management and escalating penalties.

-- ============================================
-- VIOLATION SEVERITY ENUM
-- ============================================
-- Indicates how serious a violation is:
-- minor: Warning only (first offense typically)
-- moderate: Fine possible
-- major: Fine required
-- severe: May result in access suspension

CREATE TYPE violation_severity AS ENUM (
  'minor',
  'moderate',
  'major',
  'severe'
);

COMMENT ON TYPE violation_severity IS
  'Violation severity levels:
   - minor: Warning only (first offense typically)
   - moderate: Fine possible
   - major: Fine required
   - severe: May result in access suspension';

-- ============================================
-- SANCTION TYPE ENUM
-- ============================================
-- Types of sanctions that can be applied (escalating):
-- verbal_warning: Initial verbal notice
-- written_warning: Formal written warning
-- fine: Monetary penalty
-- amenity_suspension: Temporary loss of amenity access
-- access_restriction: Limited community access
-- legal_action: Escalation to legal proceedings

CREATE TYPE sanction_type AS ENUM (
  'verbal_warning',
  'written_warning',
  'fine',
  'amenity_suspension',
  'access_restriction',
  'legal_action'
);

COMMENT ON TYPE sanction_type IS
  'Sanction types (escalating severity):
   - verbal_warning: Initial verbal notice
   - written_warning: Formal written warning
   - fine: Monetary penalty
   - amenity_suspension: Temporary loss of amenity access
   - access_restriction: Limited community access
   - legal_action: Escalation to legal proceedings';
