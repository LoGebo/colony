-- Migration: QR and Emergency Status Enum Types
-- Plan: 03-04 (Emergency Alerts & QR Codes)
-- Creates enum types for QR code lifecycle and emergency dispatch workflow

-- Enable pgcrypto extension for HMAC signatures (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- QR code lifecycle status
CREATE TYPE qr_status AS ENUM (
  'active',      -- QR code is valid and can be used
  'used',        -- Single-use QR has been scanned (burned)
  'expired',     -- QR code validity period has passed
  'revoked'      -- QR code manually cancelled
);

-- Emergency dispatch lifecycle status
CREATE TYPE emergency_status AS ENUM (
  'triggered',     -- Alert activated (panic button, smoke detector, etc.)
  'acknowledged',  -- Guard/dispatcher has seen the alert
  'responding',    -- Responders are en route
  'on_scene',      -- Responders have arrived
  'resolved',      -- Incident has been handled
  'false_alarm',   -- Determined to be a false alarm
  'escalated'      -- Escalated to external services (police, fire, ambulance)
);

COMMENT ON TYPE qr_status IS 'Lifecycle states for QR codes used in access control';
COMMENT ON TYPE emergency_status IS 'State machine for emergency alert dispatch workflow';
