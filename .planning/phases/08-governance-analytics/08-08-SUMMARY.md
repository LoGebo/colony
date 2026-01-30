---
phase: 08-governance-analytics
plan: 08
subsystem: analytics
tags: [kpi, pg_cron, jsonb, brin-index, summary-tables, dashboard-metrics]

# Dependency graph
requires:
  - phase: 08-01
    provides: incidents table for security KPIs
  - phase: 08-04
    provides: access_devices infrastructure
  - phase: 08-07
    provides: violations tables
  - phase: 03-02
    provides: access_logs table for entry metrics
  - phase: 04-02
    provides: transactions table for financial KPIs
  - phase: 06-01
    provides: tickets table for maintenance metrics
  - phase: 07-01
    provides: packages table for mailroom metrics
provides:
  - kpi_daily table with 25+ daily metrics per community
  - kpi_weekly table with trend calculations (% change)
  - kpi_monthly table with financial summaries and delinquency buckets
  - compute_daily_kpis() for daily aggregation
  - compute_weekly_kpis() for weekly trends
  - compute_monthly_kpis() for financial analysis
  - compute_all_*_kpis() for batch processing
  - backfill_kpis() for historical data population
  - refresh_kpis() for manual trigger
  - pg_cron scheduled jobs (1am daily, 2am Monday, 3am 1st of month)
  - cron_job_status view for monitoring
affects: [dashboard-api, mobile-app, reporting]

# Tech tracking
tech-stack:
  added: [pg_cron]
  patterns:
    - Summary tables instead of materialized views (PowerSync compatible)
    - BRIN indexes for time-series queries
    - UPSERT pattern for idempotent computation
    - Trend calculation with percentage change
    - Delinquency buckets (30/60/90 days)
    - JSONB for flexible aggregates (entries_by_hour, incidents_by_category)

key-files:
  created:
    - supabase/migrations/20260130050301_kpi_tables.sql
    - supabase/migrations/20260130050302_kpi_functions.sql
    - supabase/migrations/20260130050303_kpi_cron_jobs.sql

key-decisions:
  - "Summary tables over materialized views for PowerSync offline-sync compatibility"
  - "BRIN indexes for time-series data (1000x smaller than B-tree)"
  - "UPSERT pattern makes computation idempotent - safe to rerun"
  - "pg_cron runs at staggered times: 1am daily, 2am Monday, 3am 1st"
  - "Custom set_kpi_timestamps() trigger since KPIs have no created_by context"
  - "Exception handling for missing tables allows graceful degradation"

patterns-established:
  - "Pattern: Summary table refresh via pg_cron instead of materialized views"
  - "Pattern: Trend calculation = ((current - previous) / previous) * 100"
  - "Pattern: JSONB aggregation with jsonb_object_agg for category breakdowns"
  - "Pattern: Delinquency buckets by oldest_charge_date intervals"

# Metrics
duration: 12min
completed: 2026-01-30
---

# Phase 8 Plan 8: Analytics KPIs Summary

**Daily/weekly/monthly KPI summary tables with BRIN indexes, pg_cron scheduled refresh, and idempotent UPSERT computation from 10+ operational tables**

## Performance

- **Duration:** 12 min
- **Started:** 2026-01-30T05:00:00Z
- **Completed:** 2026-01-30T05:12:00Z
- **Tasks:** 3
- **Files created:** 3

## Accomplishments

- Created kpi_daily table with 25+ metrics covering access, security, financial, communication, amenities, packages, and maintenance
- Created kpi_weekly table with trend calculations (% change vs previous week)
- Created kpi_monthly table with financial summaries, delinquency buckets, and utilization metrics
- Implemented compute_daily_kpis() aggregating from access_logs, incidents, transactions, tickets, packages, reservations, announcements, messages
- Implemented compute_weekly_kpis() with automatic trend calculation
- Implemented compute_monthly_kpis() with collection rate, delinquency buckets (30/60/90 days), avg resolution times
- Configured pg_cron jobs for automated refresh at appropriate intervals
- Created helper functions for manual refresh and backfill

## Task Commits

Each task was committed atomically:

1. **Task 1: Create KPI summary tables** - Applied via Supabase migration 20260130050301
2. **Task 2: Create KPI computation functions** - Applied via Supabase migration 20260130050302
3. **Task 3: Create pg_cron scheduled jobs** - Applied via Supabase migration 20260130050303

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migrations/20260130050301_kpi_tables.sql` | ~270 | kpi_daily, kpi_weekly, kpi_monthly tables with indexes and RLS |
| `supabase/migrations/20260130050302_kpi_functions.sql` | ~650 | compute_*_kpis functions with aggregation logic |
| `supabase/migrations/20260130050303_kpi_cron_jobs.sql` | ~130 | pg_cron jobs and helper functions |

## Schema Overview

### KPI Tables

**kpi_daily** - Daily operational metrics:
- Access: total_entries, resident_entries, visitor_entries, denied_entries, entries_by_hour (JSONB)
- Security: incidents_reported, incidents_resolved, patrol_checkpoints_completed, patrol_checkpoints_missed
- Financial: payments_received, payments_amount, new_charges_count, new_charges_amount
- Delinquency: units_delinquent, total_delinquent_amount
- Communication: announcements_sent, messages_sent
- Amenities: reservations_made, reservations_cancelled, no_shows
- Packages: packages_received, packages_picked_up, packages_pending
- Maintenance: tickets_opened, tickets_closed

**kpi_weekly** - Weekly aggregates with trends:
- Aggregates: total_entries, avg_daily_entries, incidents_*, payments_amount
- Trends: entries_change_pct, incidents_change_pct, payments_change_pct

**kpi_monthly** - Monthly financial summaries:
- Financial: total_billed, total_collected, collection_rate, collection_rate_change
- Delinquency: units_delinquent_30/60/90_days, total_delinquent_amount
- Incidents: total_incidents, incidents_by_category (JSONB), avg_resolution_hours
- Amenities: total_reservations, utilization_by_amenity (JSONB)
- Maintenance: tickets_*, avg_ticket_resolution_hours
- Packages: packages_*, avg_pickup_days

### Computation Functions

| Function | Purpose |
|----------|---------|
| `compute_daily_kpis(community_id, date)` | Aggregate daily metrics from operational tables |
| `compute_weekly_kpis(community_id, week_start)` | Aggregate from kpi_daily with trends |
| `compute_monthly_kpis(community_id, year, month)` | Financial summaries and averages |
| `compute_all_daily_kpis(date)` | Process all communities for cron |
| `compute_all_weekly_kpis(week_start)` | Process all communities for cron |
| `compute_all_monthly_kpis(year, month)` | Process all communities for cron |
| `backfill_kpis(community_id, start, end)` | Historical data population |
| `refresh_kpis(community_id, days_back)` | Manual refresh with week/month processing |
| `get_pending_kpi_dates(community_id, days_back)` | Find gaps in KPI data |

### Scheduled Jobs

| Job Name | Schedule | Description |
|----------|----------|-------------|
| `compute-daily-kpis` | 0 1 * * * (1 AM daily) | Previous day's metrics |
| `compute-weekly-kpis` | 0 2 * * 1 (2 AM Monday) | Previous week's aggregates |
| `compute-monthly-kpis` | 0 3 1 * * (3 AM 1st) | Previous month's summaries |
| `cleanup-cron-history` | 0 4 * * 0 (4 AM Sunday) | Remove old job run details |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Summary tables not materialized views | PowerSync requires regular tables for offline sync |
| BRIN indexes for dates | 1000x smaller than B-tree for time-series data |
| UPSERT pattern | Idempotent - safe to rerun without duplicates |
| Custom timestamp trigger | KPIs are system-computed, no created_by user context |
| Exception handling for tables | Graceful degradation if some tables don't exist |
| Staggered cron times | Spread load: daily at 1am, weekly at 2am, monthly at 3am |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] update_updated_at() function not found**
- **Found during:** Task 1 (KPI tables migration)
- **Issue:** Plan referenced update_updated_at() but project uses set_audit_fields()
- **Fix:** Created custom set_kpi_timestamps() trigger function since KPI tables don't have created_by column
- **Files modified:** 20260130050301_kpi_tables.sql
- **Verification:** Migration applied successfully

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary adaptation to project's existing audit infrastructure. No scope creep.

## Issues Encountered

None - all migrations applied successfully after the trigger function fix.

## User Setup Required

None - pg_cron is enabled by default on Supabase and jobs are automatically scheduled.

## Verification

### KPI Tables Created
- kpi_daily with 25+ metric columns
- kpi_weekly with trend calculations
- kpi_monthly with financial summaries

### Indexes
- BRIN indexes on date columns for efficient time-series queries
- B-tree indexes for community + date filtering

### RLS Policies
- super_admin: full access to all communities
- community_admin/manager: SELECT on own community's KPIs

### Cron Jobs Scheduled
- Daily: 1:00 AM UTC (compute previous day)
- Weekly: 2:00 AM UTC Monday (compute previous week)
- Monthly: 3:00 AM UTC 1st (compute previous month)

## Next Phase Readiness

**KPI infrastructure complete:**
- Dashboard APIs can query pre-computed metrics for instant response
- Mobile apps get fast analytics without real-time aggregation
- Historical data can be backfilled with backfill_kpis()
- Manual refresh available via refresh_kpis()
- Monitoring available via cron_job_status view

**Integration points:**
- Dashboard: Query kpi_daily/weekly/monthly with community_id filter
- Reports: Use kpi_monthly for financial reports and delinquency tracking
- Alerts: Check kpi_daily for unusual patterns (spikes in incidents, etc.)

---
*Phase: 08-governance-analytics*
*Completed: 2026-01-30*
