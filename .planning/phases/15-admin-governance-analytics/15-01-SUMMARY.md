---
phase: 15-admin-governance-analytics
plan: 01
subsystem: admin-navigation-querykeys
tags: [sidebar, navigation, query-keys, tanstack-query, heroicons]
depends_on: []
provides:
  - Admin sidebar with governance, violations, emergency, devices, analytics navigation
  - Query key factories for assemblies, violations, emergencyContacts, devices, guardMetrics, audit
affects:
  - 15-02 (governance pages use sidebar nav + query keys)
  - 15-03 (violations pages use sidebar nav + query keys)
  - 15-04 (emergency/devices pages use sidebar nav + query keys)
  - 15-05 (analytics pages use sidebar nav + query keys)
tech-stack:
  added: []
  patterns:
    - Inline SVG Heroicons for sidebar icons (established pattern continued)
    - Alphabetized mergeQueryKeys for maintainability
key-files:
  created: []
  modified:
    - packages/admin/src/app/(dashboard)/layout.tsx
    - packages/shared/src/queries/keys.ts
decisions:
  - Alphabetized mergeQueryKeys entries for easier lookup (was insertion-order before)
  - Used chart-bar-square Heroicon for analytics (distinct from existing chart icon on reports)
metrics:
  duration: 4m
  completed: 2026-02-09
---

# Phase 15 Plan 01: Navigation & Query Keys Foundation Summary

**One-liner:** Admin sidebar extended with 5 governance/analytics nav sections + 6 query key factories for all Phase 15 entities

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add Phase 15 sidebar navigation sections | f55edb7 | 5 new NavItems with children, 5 new Heroicon SVGs |
| 2 | Add query key factories for Phase 15 entities | a0fcb3b | 6 new factories, alphabetized mergeQueryKeys |

## What Was Built

### Sidebar Navigation (layout.tsx)
5 new top-level nav sections added between Marketplace and Settings:

1. **Gobernanza** (scale icon) -- children: Elecciones, Asambleas
2. **Infracciones** (shield-exclamation icon) -- no children
3. **Emergencia** (bell-alert icon) -- children: Contactos, Info Medica, Evacuacion
4. **Dispositivos** (key icon) -- no children
5. **Analiticas** (chart-bar icon) -- children: Guardias, Auditoria

### Query Key Factories (keys.ts)
6 new factories added to shared query keys:

1. **assemblies** -- list, detail, attendance, agreements
2. **violations** -- list, detail, sanctions, appeals, types
3. **emergencyContacts** -- byResident, byUnit, evacuation, medical
4. **devices** -- list, detail, types, assignments
5. **guardMetrics** -- performance (with dateRange), patrolStats
6. **audit** -- logs (with filters)

All 6 added to mergeQueryKeys. Existing elections factory preserved (not duplicated).

## Deviations from Plan

### Minor Improvement
**Alphabetized mergeQueryKeys entries** -- The plan said "keep alphabetical ordering consistent with existing entries" but existing entries were in insertion order. Alphabetized all entries for consistency and maintainability. This is purely organizational with zero runtime impact.

## Verification

- `npx tsc --noEmit` in shared: zero errors
- `npx tsc --noEmit` in admin: zero new errors (pre-existing errors in providers/moderation unrelated)
- Visual inspection confirms all 5 nav sections with correct hrefs, labels, icons, and children
- All 6 query key factories present in merged export

## Next Phase Readiness

All Phase 15 plans (02-05) can now:
- Route to governance, violations, emergency, devices, and analytics pages via sidebar
- Use `queryKeys.assemblies.*`, `queryKeys.violations.*`, etc. for TanStack Query cache management
