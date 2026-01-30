-- Migration: Package Management Enum Types
-- Plan: 07-01 (Package Management Schema)
-- Creates enums for package status state machine, carriers, and pickup codes

-- ============================================
-- PACKAGE STATUS ENUM
-- ============================================
-- State machine for package lifecycle

CREATE TYPE package_status AS ENUM (
  'received',        -- Package checked in by guard/staff
  'stored',          -- Assigned to storage location
  'notified',        -- Recipient notified with pickup code
  'pending_pickup',  -- Pickup code sent, awaiting recipient
  'picked_up',       -- Successfully retrieved by recipient
  'forwarded',       -- Forwarded to another address
  'returned',        -- Returned to sender
  'abandoned'        -- Exceeded retention period
);

COMMENT ON TYPE package_status IS
  'Package lifecycle states with defined transitions:
   received -> stored, returned
   stored -> notified, returned
   notified -> pending_pickup, returned
   pending_pickup -> picked_up, abandoned, returned, forwarded
   abandoned -> returned
   Terminal states: picked_up, forwarded, returned (from other states)';

-- ============================================
-- PACKAGE CARRIER ENUM
-- ============================================
-- Common carriers in Mexico

CREATE TYPE package_carrier AS ENUM (
  'fedex',
  'dhl',
  'ups',
  'estafeta',
  'redpack',
  'mercado_libre',
  'amazon',
  'correos_mexico',
  'other'
);

COMMENT ON TYPE package_carrier IS 'Common package carriers in Mexico. Use other for unlisted carriers.';

-- ============================================
-- PICKUP CODE TYPE ENUM
-- ============================================

CREATE TYPE pickup_code_type AS ENUM (
  'pin',     -- 6-digit numeric code
  'qr'       -- QR code with HMAC-signed payload
);

COMMENT ON TYPE pickup_code_type IS 'Types of pickup verification codes.';

-- ============================================
-- PICKUP CODE STATUS ENUM
-- ============================================

CREATE TYPE pickup_code_status AS ENUM (
  'active',   -- Code is valid and can be used
  'used',     -- Code has been used for pickup
  'expired',  -- Code validity period ended
  'revoked'   -- Code manually invalidated
);

COMMENT ON TYPE pickup_code_status IS 'Status of pickup codes. Terminal states: used, expired, revoked.';
