---
phase: 06-maintenance-chat-documents-notifications
plan: 02
subsystem: maintenance-preventive
tags: [assets, maintenance, rrule, escalation, sla, preventive]
depends_on:
  requires: [06-01]
  provides: [assets, preventive_schedules, escalation_rules]
  affects: [06-05, 07-*, 08-*]
tech-stack:
  added: []
  patterns: [rrule-recurrence, trigger-based-escalation, generated-columns]
key-files:
  created:
    - supabase/migrations/20260130001013_assets_tables.sql
    - supabase/migrations/20260130001154_preventive_schedules.sql
    - supabase/migrations/20260130001504_escalation_rules.sql
  modified: []
decisions:
  - id: asset-status-enum
    choice: 5-state lifecycle (operational, degraded, maintenance, out_of_service, retired)
    rationale: Covers full asset lifecycle from active use through decommissioning
  - id: rrule-mvp
    choice: MVP RRULE parser supporting DAILY/WEEKLY/MONTHLY/YEARLY with INTERVAL and BYMONTHDAY
    rationale: Covers 90% of preventive maintenance use cases; full RFC 5545 via pg_rrule extension later
  - id: escalation-cooldown
    choice: 24-hour cooldown before re-escalating same ticket/rule combo
    rationale: Prevents notification spam while allowing persistent issues to re-escalate
  - id: generated-total-cost
    choice: total_cost as GENERATED ALWAYS column (labor_cost + parts_cost)
    rationale: Ensures data consistency, no application logic needed
metrics:
  duration: 10 min
  completed: 2026-01-30
---

# Phase 6 Plan 2: Assets & Preventive Maintenance Summary

Asset registry with lifecycle tracking, RRULE-based preventive schedules with auto ticket generation, and configurable SLA escalation rules with full audit trail.

## What Was Built

### Task 1: Assets and Maintenance History

**Migration:** `20260130001013_assets_tables.sql`

**Structures Created:**
- `asset_status` enum: 5 states (operational, degraded, maintenance, out_of_service, retired)
- `assets` table: Community infrastructure with lifecycle dates, specifications, and maintenance tracking
- `asset_maintenance_history` table: All maintenance work with cost tracking and ticket links
- `update_asset_maintenance_date()` trigger: Auto-updates last_maintenance_at and calculates next_maintenance_due
- `tickets.asset_id` FK: Links tickets to assets for asset-centric maintenance views

**Key Columns:**
- Lifecycle: purchased_at, installed_at, warranty_expires_at, expected_end_of_life
- Financial: purchase_cost, current_value, depreciation_method
- Maintenance: last_maintenance_at, next_maintenance_due, maintenance_interval_days
- Technical: specifications JSONB, photo_urls TEXT[]
- Cost: total_cost GENERATED ALWAYS AS (labor_cost + parts_cost)

### Task 2: Preventive Maintenance Schedules

**Migration:** `20260130001154_preventive_schedules.sql`

**Structures Created:**
- `preventive_schedules` table: Recurring maintenance with RRULE recurrence patterns
- `compute_next_rrule_occurrence()` function: MVP RRULE parser for common patterns
- `set_next_occurrence()` trigger: Auto-computes next_occurrence_at on insert/update
- `generate_preventive_tickets()` function: Creates tickets from active schedules
- `tickets.preventive_schedule_id` FK: Links auto-generated tickets to their schedule

**RRULE Support:**
- FREQ: DAILY, WEEKLY, MONTHLY, YEARLY
- INTERVAL: Repeat every N periods
- BYMONTHDAY: Specific day of month

**Ticket Generation:**
- Template-based title/description with {asset_name}, {date} placeholders
- Configurable generate_days_ahead (default 7 days)
- Optional auto_assign_to for immediate assignment
- Links to source schedule and asset

### Task 3: Escalation Rules

**Migration:** `20260130001504_escalation_rules.sql`

**Structures Created:**
- `escalation_rules` table: Configurable triggers with category/priority filters
- `ticket_escalations` table: Full audit trail of all escalation actions
- `check_escalation_triggers()` function: Identifies tickets matching escalation criteria
- `execute_escalation()` function: Performs action, records audit, adds system comment
- `process_escalations()` function: Convenience wrapper for pg_cron

**Trigger Types:**
| Type | Threshold Meaning | Use Case |
|------|-------------------|----------|
| response_warning | % of SLA elapsed | Alert before breach |
| response_breach | 0 (triggered on breach) | Immediate action on breach |
| resolution_warning | % of SLA elapsed | Alert before resolution deadline |
| resolution_breach | 0 (triggered on breach) | Immediate action on deadline miss |
| status_stuck | Hours in same status | Detect stalled tickets |

**Action Types:**
- `notify`: Send pg_notify for real-time alerting
- `reassign`: Change ticket assignee
- `upgrade_priority`: Increase priority (low->medium->high->urgent)
- `notify_and_reassign`: Both notification and reassignment

## Database Objects Created

### Tables
| Table | Purpose | RLS |
|-------|---------|-----|
| assets | Community infrastructure registry | Yes |
| asset_maintenance_history | All maintenance work performed | Yes |
| preventive_schedules | RRULE-based recurring schedules | Yes |
| escalation_rules | SLA trigger configurations | Yes |
| ticket_escalations | Escalation audit trail | Yes (read-only) |

### Functions
| Function | Purpose | Security |
|----------|---------|----------|
| update_asset_maintenance_date() | Trigger: auto next_maintenance_due | SECURITY DEFINER |
| compute_next_rrule_occurrence() | RRULE parsing (IMMUTABLE) | - |
| set_next_occurrence() | Trigger: auto next_occurrence_at | SECURITY DEFINER |
| generate_preventive_tickets() | Create scheduled tickets | SECURITY DEFINER |
| check_escalation_triggers() | Find matching escalations | SECURITY DEFINER |
| execute_escalation() | Perform escalation action | SECURITY DEFINER |
| process_escalations() | Wrapper for pg_cron | SECURITY DEFINER |

### Indexes
- `idx_assets_community_status`: Asset listing by status
- `idx_assets_community_type`: Asset listing by type
- `idx_assets_next_maintenance`: Upcoming maintenance queries
- `idx_maintenance_history_asset`: History by asset
- `idx_tickets_asset`: Tickets by asset
- `idx_preventive_schedules_active`: Active schedules with upcoming occurrences
- `idx_tickets_preventive_schedule`: Tickets by schedule
- `idx_escalation_rules_community_active`: Active rules by priority
- `idx_ticket_escalations_ticket`: Escalation history by ticket

## Integration Points

### With Existing Infrastructure
- **tickets table**: Added asset_id and preventive_schedule_id FKs
- **ticket_comments**: System comments auto-generated on escalation
- **pg_notify channels**: 'escalation' for real-time alerting

### For Future Phases
- **Push Notifications (06-05)**: Subscribe to 'escalation' channel for mobile alerts
- **Dashboard (07-*)**: Asset status overview, maintenance calendar, SLA performance
- **Reports (08-*)**: Maintenance cost analysis, escalation frequency, SLA compliance

## Operational Usage

### Daily Preventive Ticket Generation
```sql
-- Run via pg_cron or Edge Function every night
SELECT generate_preventive_tickets();
-- Returns count of tickets created
```

### Escalation Processing
```sql
-- Run every 15 minutes via pg_cron
SELECT process_escalations();
-- Returns count of escalations executed
```

### Example: Monthly Elevator Maintenance
```sql
INSERT INTO preventive_schedules (
  community_id, name,
  rrule, dtstart,
  category_id, priority,
  title_template, description_template,
  asset_id, generate_days_ahead
) VALUES (
  'community-uuid', 'Mantenimiento Mensual Elevadores',
  'FREQ=MONTHLY;BYMONTHDAY=15', '2026-01-15 09:00:00-06',
  'maintenance-category-uuid', 'medium',
  'Mantenimiento {asset_name} - {date}',
  'Inspeccicion mensual programada de {asset_name}',
  'elevator-asset-uuid', 7
);
-- Ticket auto-created 7 days before the 15th of each month
```

## Deviations from Plan

None - plan executed exactly as written.

## Verification Completed

1. asset_status enum created with 5 states
2. assets table with lifecycle dates and specifications
3. asset_maintenance_history with generated total_cost column
4. preventive_schedules with RRULE recurrence and auto next_occurrence_at
5. generate_preventive_tickets() function ready for pg_cron
6. escalation_rules with 5 trigger types and 4 action types
7. ticket_escalations audit trail with full state tracking
8. All tables have RLS with community isolation

## Commits

| Hash | Message |
|------|---------|
| 5eecead | feat(06-02): add assets and maintenance history tables |
| 8cc9199 | feat(06-02): add preventive maintenance schedules with RRULE recurrence |
| d98f8fc | feat(06-02): add escalation rules with configurable triggers and actions |

## Next Phase Readiness

Phase 6 Plan 2 complete. Ready for:
- **06-05**: Push notifications can subscribe to 'escalation' pg_notify channel
- **Dashboard**: Asset status widgets, maintenance calendar, SLA metrics
- **pg_cron setup**: Schedule generate_preventive_tickets() and process_escalations()
