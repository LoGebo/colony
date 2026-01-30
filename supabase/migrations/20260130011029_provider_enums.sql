-- Migration: Provider Enum Types
-- Phase: 07-operations-compliance
-- Plan: 02 - Provider Management
-- Description: Creates enum types for provider status workflow and document verification

-- ==================================================================
-- PROVIDER STATUS ENUM
-- ==================================================================
-- Tracks the lifecycle of provider companies:
-- pending_approval -> active (approved) -> suspended/inactive

CREATE TYPE provider_status AS ENUM (
  'pending_approval',  -- Awaiting admin review
  'active',            -- Approved and can work
  'suspended',         -- Temporarily blocked
  'inactive'           -- No longer working with community
);

COMMENT ON TYPE provider_status IS 'Provider company status workflow: pending_approval -> active -> suspended/inactive';

-- ==================================================================
-- DOCUMENT STATUS ENUM
-- ==================================================================
-- Tracks verification status of provider documents (insurance, licenses, etc.)

CREATE TYPE document_status AS ENUM (
  'pending_verification',  -- Uploaded, not yet reviewed
  'verified',              -- Admin confirmed valid
  'expired',               -- Past expiration date
  'rejected'               -- Failed verification
);

COMMENT ON TYPE document_status IS 'Provider document verification status: pending_verification -> verified/rejected, verified -> expired';
