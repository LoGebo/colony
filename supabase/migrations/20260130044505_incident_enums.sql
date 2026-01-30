-- ============================================
-- INCIDENT ENUM TYPES
-- ============================================
-- Phase 8 Plan 01: Incident Management Schema
--
-- Creates enum types for incident severity levels and workflow status.
-- These enums support the incident management system for tracking
-- security, maintenance, noise, and other community incidents.

-- ============================================
-- INCIDENT SEVERITY LEVELS
-- ============================================
-- Determines urgency and response requirements

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_severity') THEN
    CREATE TYPE incident_severity AS ENUM (
      'low',        -- Nuisance, non-urgent matters
      'medium',     -- Requires attention within 24 hours
      'high',       -- Requires immediate attention
      'critical'    -- Emergency - life/safety at risk
    );
  END IF;
END$$;

COMMENT ON TYPE incident_severity IS
  'Incident severity levels determining urgency and response requirements.
   low: Nuisance, non-urgent
   medium: Attention within 24h
   high: Immediate attention
   critical: Emergency, life/safety';

-- ============================================
-- INCIDENT WORKFLOW STATUS
-- ============================================
-- Tracks incident lifecycle from report to closure

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
    CREATE TYPE incident_status AS ENUM (
      'reported',       -- Initial report received
      'acknowledged',   -- Staff aware, not yet assigned
      'investigating',  -- Under investigation
      'in_progress',    -- Resolution in progress
      'pending_review', -- Awaiting supervisor review
      'resolved',       -- Issue resolved
      'closed'          -- Formally closed
    );
  END IF;
END$$;

COMMENT ON TYPE incident_status IS
  'Incident workflow status tracking lifecycle from report to closure.
   reported -> acknowledged -> investigating -> in_progress -> pending_review -> resolved -> closed
   Not all transitions are required; some may be skipped based on incident type.';
