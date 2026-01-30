-- ============================================
-- ACCESS DEVICE ENUM TYPES
-- ============================================
-- Phase 08-05: Access Device Lifecycle Management
-- Enum types for access device categories and status tracking

-- ============================================
-- DEVICE TYPE ENUM
-- ============================================
-- Categories of physical access credentials

CREATE TYPE device_type AS ENUM (
  'rfid_tag',       -- Proximity tag/fob
  'rfid_card',      -- Proximity card
  'remote',         -- Gate remote control
  'physical_key',   -- Traditional key
  'transponder',    -- Vehicle transponder
  'biometric'       -- Biometric enrollment (fingerprint, etc.)
);

COMMENT ON TYPE device_type IS
  'Categories of physical access credentials.
   rfid_tag/rfid_card for proximity access,
   remote for gate controls,
   physical_key for traditional locks,
   transponder for vehicle access,
   biometric for fingerprint/face enrollment.';

-- ============================================
-- DEVICE STATUS ENUM
-- ============================================
-- Device lifecycle status tracking

CREATE TYPE device_status AS ENUM (
  'in_inventory',   -- Available for assignment
  'assigned',       -- Currently assigned to someone
  'lost',           -- Reported lost
  'damaged',        -- Damaged, needs replacement
  'deactivated',    -- Intentionally disabled
  'retired'         -- Permanently out of service
);

COMMENT ON TYPE device_status IS
  'Lifecycle status for access devices.
   in_inventory: available for assignment
   assigned: currently issued to someone
   lost: reported lost (requires deactivation)
   damaged: physical damage (may be repairable)
   deactivated: security disabled but device exists
   retired: permanently removed from circulation';
