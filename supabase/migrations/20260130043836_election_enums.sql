-- Election enum types for governance voting
-- Phase 8-02: Elections and Voting
-- Migration: 20260130043836_election_enums.sql

-- Election types: what kind of vote is being conducted
CREATE TYPE election_type AS ENUM (
  'board_election',         -- Electing board members
  'bylaw_amendment',        -- Changing reglamento
  'extraordinary_expense',  -- Approving special assessment
  'general_decision'        -- Other assembly decisions
);

-- Election lifecycle status
CREATE TYPE election_status AS ENUM (
  'draft',        -- Being prepared
  'scheduled',    -- Approved, waiting for date
  'open',         -- Voting in progress
  'closed',       -- Voting ended, counting
  'certified',    -- Results certified
  'cancelled'
);

-- Comments for documentation
COMMENT ON TYPE election_type IS 'Types of elections: board_election, bylaw_amendment, extraordinary_expense, general_decision';
COMMENT ON TYPE election_status IS 'Election lifecycle: draft -> scheduled -> open -> closed -> certified (or cancelled)';
