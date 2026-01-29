-- ============================================
-- BASE ENUMS FOR UPOE
-- ============================================
-- These enums are used across multiple tables and phases.
-- IMPORTANT: Enum values cannot be removed in production,
-- only added. Design carefully.

-- ============================================
-- GENERAL STATUS ENUM
-- ============================================
-- Universal status for records that can be activated/deactivated

CREATE TYPE general_status AS ENUM (
  'active',
  'inactive',
  'pending',
  'archived',
  'suspended'
);

COMMENT ON TYPE general_status IS
  'Universal status enum for entities. Use pending for items awaiting action.';

-- ============================================
-- APPROVAL STATUS ENUM
-- ============================================
-- For items that go through approval workflow

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'expired'
);

COMMENT ON TYPE approval_status IS
  'Status for items in approval workflows (invitations, payments, documents).';

-- ============================================
-- USER ROLES ENUM
-- ============================================
-- System-wide user roles

CREATE TYPE user_role AS ENUM (
  'super_admin',    -- Platform level, all communities
  'admin',          -- Community administrator
  'manager',        -- Community manager (partial admin)
  'guard',          -- Security personnel
  'resident',       -- Property resident (owner or tenant)
  'provider',       -- Service provider
  'visitor'         -- Temporary access
);

COMMENT ON TYPE user_role IS
  'System roles determining access level. Stored in JWT app_metadata.';

-- ============================================
-- UNIT TYPES ENUM
-- ============================================
-- Types of properties within a community

CREATE TYPE unit_type AS ENUM (
  'casa',           -- House
  'departamento',   -- Apartment
  'local',          -- Commercial space
  'bodega',         -- Storage unit
  'oficina',        -- Office
  'terreno',        -- Land/lot
  'estacionamiento' -- Parking space (when sold/rented separately)
);

COMMENT ON TYPE unit_type IS
  'Property unit types in Mexican residential communities.';

-- ============================================
-- OCCUPANCY TYPES ENUM
-- ============================================
-- Relationship between resident and unit

CREATE TYPE occupancy_type AS ENUM (
  'owner',          -- Property owner
  'tenant',         -- Renting the property
  'authorized',     -- Authorized occupant (family member, etc.)
  'employee'        -- Domestic employee living on premises
);

COMMENT ON TYPE occupancy_type IS
  'Type of resident relationship to a unit.';

-- ============================================
-- ACCESS DECISION ENUM
-- ============================================
-- Security access decisions

CREATE TYPE access_decision AS ENUM (
  'allowed',
  'pending',
  'denied',
  'blocked'
);

COMMENT ON TYPE access_decision IS
  'Access control decisions. blocked > denied > pending > allowed for conflict resolution.';

-- ============================================
-- EMERGENCY TYPES ENUM
-- ============================================
-- Types of emergency alerts

CREATE TYPE emergency_type AS ENUM (
  'panic',          -- Panic button / general emergency
  'medical',        -- Medical emergency
  'fire',           -- Fire emergency
  'intrusion',      -- Security breach
  'natural_disaster' -- Earthquake, flood, etc.
);

COMMENT ON TYPE emergency_type IS
  'Types of emergency alerts for quick categorization and response.';

-- ============================================
-- PRIORITY LEVELS ENUM
-- ============================================
-- Universal priority levels

CREATE TYPE priority_level AS ENUM (
  'low',
  'medium',
  'high',
  'urgent',
  'critical'
);

COMMENT ON TYPE priority_level IS
  'Priority levels for tickets, alerts, and notifications.';

-- ============================================
-- MONEY AMOUNT DOMAIN TYPE
-- ============================================
-- CRITICAL: Always use this for financial amounts
-- NEVER use float, real, double precision, or money type

CREATE DOMAIN money_amount AS NUMERIC(15, 4)
  CHECK (VALUE IS NULL OR VALUE >= 0);

COMMENT ON DOMAIN money_amount IS
  'Domain type for all monetary values.
   NUMERIC(15,4) supports up to 99,999,999,999.9999 with 4 decimal precision.
   4 decimals required for GAAP compliance and interest calculations.
   NEVER use float/real/money types for financial data.';

-- For amounts that can be negative (credits, adjustments)
CREATE DOMAIN money_amount_signed AS NUMERIC(15, 4);

COMMENT ON DOMAIN money_amount_signed IS
  'Domain type for monetary values that can be negative (credits, adjustments, journal entries).';

-- ============================================
-- CURRENCY CODE TYPE
-- ============================================
-- ISO 4217 currency codes

CREATE DOMAIN currency_code AS VARCHAR(3)
  CHECK (VALUE ~ '^[A-Z]{3}$');

COMMENT ON DOMAIN currency_code IS
  'ISO 4217 3-letter currency code (MXN, USD, EUR, etc.).';

-- ============================================
-- PHONE NUMBER TYPE
-- ============================================
-- E.164 format phone numbers

CREATE DOMAIN phone_number AS VARCHAR(20)
  CHECK (VALUE IS NULL OR VALUE ~ '^\+?[0-9]{10,15}$');

COMMENT ON DOMAIN phone_number IS
  'Phone number in E.164 format. Allows + prefix and 10-15 digits.';

-- ============================================
-- TIMEZONE TYPE
-- ============================================
-- Valid PostgreSQL timezone names

-- Simpler version that accepts any text (validate in application):
CREATE DOMAIN timezone_name AS TEXT;

COMMENT ON DOMAIN timezone_name IS
  'Timezone identifier (e.g., America/Mexico_City). Validated at application level.';

-- ============================================
-- LOCALE TYPE
-- ============================================
-- Language/region codes

CREATE DOMAIN locale_code AS VARCHAR(10)
  CHECK (VALUE IS NULL OR VALUE ~ '^[a-z]{2}(-[A-Z]{2})?$');

COMMENT ON DOMAIN locale_code IS
  'BCP 47 locale code (es, es-MX, en-US, etc.).';
