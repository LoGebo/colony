---
phase: 06-maintenance-chat-documents-notifications
plan: 01
subsystem: maintenance-ticketing
tags: [tickets, sla, state-machine, workflow, maintenance]
depends_on:
  requires:
    - 01-02 (RLS helpers, audit triggers)
    - 02-01 (residents table for reported_by FK)
  provides:
    - ticket_status enum (8 states)
    - ticket_priority enum (4 levels)
    - ticket_categories table
    - sla_definitions table
    - tickets table with state machine
    - ticket_assignments table
    - ticket_comments table
  affects:
    - 06-02 (assets, preventive maintenance will add FKs to tickets)
tech-stack:
  added: []
  patterns:
    - ENUM state machine with trigger validation
    - SLA matrix lookup table
    - Auto-computed timestamps via triggers
    - Audit trail via system comments
key-files:
  created:
    - supabase/migrations/20260129234530_ticket_enums.sql
    - supabase/migrations/20260129234531_ticket_categories.sql
    - supabase/migrations/20260129234700_tickets_sla.sql
    - supabase/migrations/20260129235100_ticket_assignments_comments.sql
  modified: []
decisions:
  - id: state-machine-enum
    choice: "ENUM-based state machine with trigger validation"
    reason: "Type safety, database-enforced transitions, clear audit trail"
  - id: sla-matrix
    choice: "Lookup table with category+priority matrix"
    reason: "Configurable per community, NULL category for catch-all defaults"
  - id: system-comments
    choice: "Auto-generated comments for status/assignment/priority changes"
    reason: "Complete audit trail without requiring application logic"
metrics:
  duration: "9 min"
  completed: "2026-01-29"
---

# Phase 6 Plan 1: Ticket Enums, Categories, SLA & Workflow Summary

Ticket state machine with ENUM-based status validation, SLA matrix for response/resolution times, and auto-generated audit comments for status/assignment changes.

## What Was Built

### Core Schema

**Enums Created:**
- `ticket_status` (8 states): open, assigned, in_progress, pending_parts, pending_resident, resolved, closed, cancelled
- `ticket_priority` (4 levels): low, medium, high, urgent

**Tables Created:**
1. `ticket_categories` - Community-specific categories with hierarchy support
2. `sla_definitions` - Category+priority matrix for response/resolution times
3. `tickets` - Main ticket table with state machine and SLA tracking
4. `ticket_assignments` - Historical assignment tracking
5. `ticket_comments` - Updates, photos, and system-generated entries

### Key Functions

| Function | Purpose |
|----------|---------|
| `validate_ticket_transition()` | Enforces valid state transitions via BEFORE UPDATE trigger |
| `compute_sla_due_dates()` | Calculates SLA due dates from matrix with defaults |
| `set_ticket_sla_dates()` | Auto-computes SLA on ticket creation |
| `recompute_sla_on_priority_change()` | Updates SLA when priority changes |
| `check_sla_breaches()` | Flags breaches for periodic execution |
| `notify_sla_breach()` | Sends pg_notify on breach for real-time alerts |
| `update_ticket_assigned_to()` | Syncs assignment to tickets table |
| `auto_comment_on_status_change()` | Creates audit comment on status change |
| `auto_comment_on_assignment()` | Creates audit comment on assignment |
| `auto_comment_on_priority_change()` | Creates audit comment on priority change |

### State Machine Transitions

```
open       -> assigned, cancelled
assigned   -> in_progress, open, cancelled
in_progress -> pending_parts, pending_resident, resolved, assigned
pending_parts -> in_progress, cancelled
pending_resident -> in_progress, resolved, cancelled
resolved   -> closed, in_progress (reopen)
closed     -> (terminal)
cancelled  -> (terminal)
```

### Default SLA Times (when no sla_definitions configured)

| Priority | Response | Resolution |
|----------|----------|------------|
| low | 72 hours | 7 days |
| medium | 24 hours | 3 days |
| high | 4 hours | 24 hours |
| urgent | 1 hour | 4 hours |

## Decisions Made

1. **State machine via ENUM + trigger** - Database-enforced transitions prevent invalid states from any client
2. **SLA matrix with NULL category fallback** - Specific category SLAs override catch-all defaults
3. **System comments for audit** - Auto-generated comments track all status, assignment, and priority changes
4. **Assignment history table** - Separate table tracks who worked on what and when
5. **pg_notify for breach alerts** - Real-time notification channel for SLA breach detection

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All migrations applied successfully:
- 20260129234530_ticket_enums.sql
- 20260129234531_ticket_categories.sql
- 20260129234700_tickets_sla.sql
- 20260129235100_ticket_assignments_comments.sql

State machine enforced:
- Invalid transition (open -> closed) would raise exception
- Valid transitions update status_changed_at
- first_responded_at set when leaving 'open' to non-cancelled
- resolved_at set when entering 'resolved'

## Files Changed

| File | Type | Purpose |
|------|------|---------|
| `20260129234530_ticket_enums.sql` | migration | ticket_status, ticket_priority enums |
| `20260129234531_ticket_categories.sql` | migration | ticket_categories table + RLS |
| `20260129234700_tickets_sla.sql` | migration | sla_definitions, tickets, SLA functions |
| `20260129235100_ticket_assignments_comments.sql` | migration | ticket_assignments, ticket_comments |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| 187a371 | feat | add ticket enums and categories |
| cc405eb | feat | add SLA definitions and tickets table |
| 74ccffa | feat | add ticket assignments and comments |

## Next Phase Readiness

**Ready for 06-02 (Assets & Preventive Maintenance):**
- tickets table has asset_id and preventive_schedule_id columns ready for FKs
- State machine supports preventive maintenance workflow (auto-generated tickets)

**Integration points:**
- tickets.asset_id will FK to assets table in 06-02
- tickets.preventive_schedule_id will FK to preventive_schedules in 06-02
- check_sla_breaches() can be called from pg_cron or Edge Function
- pg_notify('sla_breach') enables Supabase Realtime subscription for alerts
