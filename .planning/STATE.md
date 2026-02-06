# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-06)

**Core value:** Symbiosis operativa total - security, administration, community, and commerce unified in one ecosystem
**Current focus:** Milestone v2.0 — Frontend Applications (defining requirements)

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-02-06 — Milestone v2.0 started

## Previous Milestone: v1.0 Database Architecture

**Completed:** 2026-01-30
**Summary:** 8 phases, 38 plans, 128+ migrations
**Deliverables:** 116 tables, 399 RLS policies, 206 functions, 8 storage buckets, 3 edge functions, auth triggers, seed data

## Performance Metrics

**v1.0 Velocity:**
- Total plans completed: 38
- Average duration: 6.2 min
- Total execution time: ~236 min

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Key decisions carrying forward to v2.0:

- Supabase auto-API (PostgREST) — no custom backend needed
- React Native with Expo 54 (managed workflow)
- Next.js 16 for admin dashboard
- Monorepo with pnpm workspaces
- residents.user_id links to auth.users (NOT residents.id which is business ID)
- guards.user_id links to auth.users (nullable)
- JWT app_metadata contains: community_id, role, resident_id/guard_id
- Three auth flows: invited resident, invited guard, new admin
- 8 storage buckets with folder-based RLS: {community_id}/{entity_id}/{filename}
- frontend-design skill for all UI implementations

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-06
Stopped at: Milestone v2.0 initialization
Resume file: None
