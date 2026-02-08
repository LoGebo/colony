---
phase: 11-admin-dashboard-financial-core
plan: 01
subsystem: ui, database
tags: [recharts, tanstack-table, xlsx, sonner, kpi, charts, rls, financial-dashboard]

# Dependency graph
requires:
  - phase: 09-auth-shared-infrastructure
    provides: Auth hooks (useAuth), Supabase client structure, sidebar layout, QueryProvider
provides:
  - Financial overview dashboard with 4 KPI cards and 3 charts
  - Shared UI primitives (Card, Badge, Button, DataTable)
  - Chart components (KPICard, CollectionChart, DelinquencyChart, ExpenseChart)
  - Financial hooks (useKPIMonthly, useKPIMonthlyRange, useTransactionSummary, useExpenseBreakdown, useDelinquentUnits)
  - Utility libs (formatters for MXN/dates/percentages, Excel export)
  - Income vs expense reports page with Excel export
  - Fixed RLS policies accepting community_admin role
  - Deployed record_payment, record_charge, generate_transaction_reference functions
affects: [11-02, 11-03, 11-04, 12-admin-resident-management]

# Tech tracking
tech-stack:
  added: [recharts@3.7.0, "@tanstack/react-table@8.21.3", xlsx@0.18.5, sonner@2.0.7, date-fns@4.1.0]
  patterns: [Recharts client components with props data, TanStack Table with manual pagination, lazy Supabase client in queryFn, Sonner toast provider in root layout]

key-files:
  created:
    - packages/admin/src/components/charts/KPICard.tsx
    - packages/admin/src/components/charts/CollectionChart.tsx
    - packages/admin/src/components/charts/DelinquencyChart.tsx
    - packages/admin/src/components/charts/ExpenseChart.tsx
    - packages/admin/src/components/ui/Card.tsx
    - packages/admin/src/components/ui/Badge.tsx
    - packages/admin/src/components/ui/Button.tsx
    - packages/admin/src/components/ui/DataTable.tsx
    - packages/admin/src/hooks/useFinancials.ts
    - packages/admin/src/lib/formatters.ts
    - packages/admin/src/lib/export.ts
    - packages/admin/src/app/(dashboard)/finances/reports/page.tsx
    - supabase/migrations/20260208123300_fix_admin_rls_role_mismatch.sql
    - supabase/migrations/20260208123301_deploy_record_payment_charge.sql
  modified:
    - packages/admin/src/app/(dashboard)/page.tsx
    - packages/admin/src/app/(dashboard)/layout.tsx
    - packages/admin/src/app/layout.tsx
    - packages/admin/package.json

key-decisions:
  - "Lazy Supabase client creation inside queryFn (not hook body) to avoid SSR prerender crashes"
  - "Added community_admin AND admin to RLS IN clauses (not replacement) for backwards compatibility"
  - "Budget policies also upgraded to include manager role (previously admin-only)"

patterns-established:
  - "Lazy queryFn client: createClient() inside queryFn, not at hook scope, prevents SSR crashes"
  - "Chart data flow: hook returns raw data -> page transforms with useMemo -> chart component receives typed props"
  - "Sidebar sub-navigation: NavItem.children expand/collapse when parent route is active"

# Metrics
duration: 10min
completed: 2026-02-08
---

# Phase 11 Plan 01: Financial Dashboard Foundation Summary

**Recharts-based financial overview dashboard with 4 KPI cards, collection/delinquency/expense charts, DataTable reports page with Excel export, and 10 fixed RLS policies accepting community_admin role**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-08T12:32:22Z
- **Completed:** 2026-02-08T12:42:07Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments
- Fixed critical RLS role mismatch: 10 policies now accept 'community_admin' alongside 'admin' and 'manager'
- Deployed 3 missing financial functions (generate_transaction_reference, record_payment, record_charge) via migration
- Built financial overview dashboard at `/` with 4 KPI cards (Total Cobrado, Total Facturado, Tasa de Cobranza, Unidades Morosas) and 3 charts
- Created reusable UI primitive library (Card, Badge, Button, DataTable) and chart component library for all Phase 11 plans
- Built income vs expense reports page at `/finances/reports` with monthly comparison DataTable and Excel export

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix RLS policies, deploy missing functions, install deps** - `5fcdf65` (fix)
2. **Task 2: Create UI primitives, charts, hooks, and dashboard** - `301d6c3` (feat)

## Files Created/Modified
- `supabase/migrations/20260208123300_fix_admin_rls_role_mismatch.sql` - Updates 10 RLS policies to accept community_admin role
- `supabase/migrations/20260208123301_deploy_record_payment_charge.sql` - Deploys 3 missing financial functions
- `packages/admin/src/lib/formatters.ts` - MXN currency, date, percentage formatters
- `packages/admin/src/lib/export.ts` - Excel export utility (SheetJS)
- `packages/admin/src/components/ui/Card.tsx` - Card wrapper component
- `packages/admin/src/components/ui/Badge.tsx` - Status badge with color variants
- `packages/admin/src/components/ui/Button.tsx` - Button with variants, sizes, loading state
- `packages/admin/src/components/ui/DataTable.tsx` - TanStack Table wrapper with pagination/sorting
- `packages/admin/src/components/charts/KPICard.tsx` - KPI metric card with trend indicator
- `packages/admin/src/components/charts/CollectionChart.tsx` - Billed vs collected bar chart
- `packages/admin/src/components/charts/DelinquencyChart.tsx` - 30/60/90 day delinquency line chart
- `packages/admin/src/components/charts/ExpenseChart.tsx` - Expense breakdown pie chart
- `packages/admin/src/hooks/useFinancials.ts` - 5 TanStack Query hooks for financial data
- `packages/admin/src/app/(dashboard)/page.tsx` - Financial overview dashboard (replaces placeholder)
- `packages/admin/src/app/(dashboard)/finances/reports/page.tsx` - Income vs expense report with export
- `packages/admin/src/app/(dashboard)/layout.tsx` - Updated sidebar with finance sub-routes
- `packages/admin/src/app/layout.tsx` - Added Sonner Toaster
- `packages/admin/package.json` - Added 5 new dependencies

## Decisions Made
- **Lazy Supabase client in queryFn:** Moved `createClient()` calls from hook body into `queryFn` callbacks to prevent SSR prerender crashes. The `enabled: !!communityId` guard ensures `queryFn` only runs client-side when auth is ready.
- **Inclusive RLS role update:** Added `'community_admin'` to existing IN clauses alongside `'admin'` (not replacing) for backwards compatibility. Also upgraded budget policies to include `'manager'` which was missing.
- **KPI range for charts:** Used `useKPIMonthlyRange` (pre-computed kpi_monthly table) for dashboard charts instead of raw transaction queries -- more efficient and consistent with existing KPI computation pipeline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Recharts Tooltip formatter type mismatch**
- **Found during:** Task 2 (chart components)
- **Issue:** Recharts v3 `Tooltip.formatter` callback receives `value: number | undefined`, not `number`. TypeScript compilation failed.
- **Fix:** Changed `(value: number) => formatCurrency(value)` to `(value) => formatCurrency(Number(value))` and added nullish coalescing for `percent` in pie label.
- **Files modified:** CollectionChart.tsx, ExpenseChart.tsx
- **Verification:** `next build` passes
- **Committed in:** 301d6c3 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed SSR prerender crash from eager Supabase client creation**
- **Found during:** Task 2 (build verification)
- **Issue:** `createClient()` called at hook body scope executes during SSR prerender when env vars are unavailable, causing build failure on `/finances/reports`.
- **Fix:** Moved all `createClient()` calls inside `queryFn` async callbacks. The `enabled` guard prevents execution during SSR.
- **Files modified:** useFinancials.ts
- **Verification:** `next build` succeeds with all pages generating static
- **Committed in:** 301d6c3 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
**Database migrations need to be applied to the live Supabase instance.** The two new migration files must be run:
1. `20260208123300_fix_admin_rls_role_mismatch.sql` - fixes 10 RLS policies
2. `20260208123301_deploy_record_payment_charge.sql` - deploys 3 financial functions

Apply via Supabase dashboard SQL editor or `supabase db push`.

## Next Phase Readiness
- All shared UI components (Card, Badge, Button, DataTable) ready for Plans 11-02, 11-03, 11-04
- Financial hooks ready for payment approval queue (11-02) and charge generation (11-03)
- Sidebar navigation already has sub-routes for approvals, charges, and reports
- `next build` passes cleanly

---
*Phase: 11-admin-dashboard-financial-core*
*Completed: 2026-02-08*
