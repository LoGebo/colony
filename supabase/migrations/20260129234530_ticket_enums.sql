-- ============================================================================
-- TICKET STATUS AND PRIORITY ENUMS
-- Phase 6, Plan 1: Maintenance Ticketing Foundation
-- ============================================================================
-- State machine order: open -> assigned -> in_progress -> pending_* -> resolved -> closed
-- Terminal states: closed, cancelled (no outgoing transitions)
-- ============================================================================

-- Ticket Status State Machine
-- Valid transitions defined in validate_ticket_transition() trigger:
--   open       -> assigned, cancelled
--   assigned   -> in_progress, open, cancelled
--   in_progress -> pending_parts, pending_resident, resolved, assigned
--   pending_parts -> in_progress, cancelled
--   pending_resident -> in_progress, resolved, cancelled
--   resolved   -> closed, in_progress (reopen)
--   closed     -> (terminal)
--   cancelled  -> (terminal)
CREATE TYPE ticket_status AS ENUM (
  'open',             -- Initial state: ticket created
  'assigned',         -- Assigned to staff/provider
  'in_progress',      -- Work started
  'pending_parts',    -- Waiting for materials
  'pending_resident', -- Waiting for resident action/access
  'resolved',         -- Work completed, awaiting confirmation
  'closed',           -- Confirmed by resident/admin (terminal)
  'cancelled'         -- Cancelled before completion (terminal)
);

COMMENT ON TYPE ticket_status IS 'Ticket lifecycle states with enforced transitions via validate_ticket_transition() trigger';

-- Ticket Priority Levels
-- Default SLA times (can be overridden per community in sla_definitions):
--   low:    72h response, 7 days resolution
--   medium: 24h response, 3 days resolution
--   high:   4h response, 24h resolution
--   urgent: 1h response, 4h resolution
CREATE TYPE ticket_priority AS ENUM (
  'low',       -- Non-critical, routine maintenance
  'medium',    -- Standard issues, default priority
  'high',      -- Urgent issues affecting daily operations
  'urgent'     -- Emergency requiring immediate attention
);

COMMENT ON TYPE ticket_priority IS 'Ticket priority levels affecting SLA response and resolution times';
