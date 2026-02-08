# Phase 11: Admin Dashboard Financial Core - Research

**Researched:** 2026-02-08
**Domain:** Next.js admin dashboard: financial KPI dashboards, payment approval workflows, charge generation, resident/unit CRUD, community configuration
**Confidence:** HIGH (verified via live DB inspection, existing codebase analysis, official docs, npm registries)

## Summary

This research covers everything needed to plan the admin dashboard financial core -- the first feature-rich phase of the Next.js admin panel. Phase 9 built the auth infrastructure and sidebar layout; Phase 10 built mobile payment proof submission. Phase 11 now needs to build the admin-side screens: financial overview with charts, payment proof approval queue, charge generation, resident/unit management, and community settings.

Key findings:
1. **Critical RLS bug**: Most admin RLS policies check for role `'admin'` but JWT sets `'community_admin'`. This means `community_admin` users CANNOT access `payment_proofs`, `transactions`, `residents`, `units`, `occupancies`, `fee_structures`, `budgets`, or `communities` for writes. Only `kpi_monthly` correctly checks for `'community_admin'`. **This must be fixed before any admin dashboard feature will work.**
2. **Missing database functions**: `record_payment`, `record_charge`, and `generate_transaction_reference` are defined in migration files but do NOT exist in the live database. The `on_payment_proof_approved` trigger calls `record_payment` which will fail. **These functions must be deployed.**
3. **Rich existing schema**: The database has a comprehensive double-entry accounting system with `transactions`, `ledger_entries`, `accounts`, `fee_structures`, `fee_schedules`, `unit_balances` view, `kpi_monthly`/`kpi_daily` tables, `budgets`/`budget_lines`, and delinquency tracking. The admin dashboard can consume all of this via PostgREST auto-API and existing RPCs.
4. **Charting**: Recharts v3.7.0 is the standard React charting library. It requires `'use client'` but works well with the pattern of fetching data server-side and passing to client chart components.
5. **Excel export**: SheetJS (`xlsx` npm package) is the standard for client-side Excel generation. No server-side processing needed.

**Primary recommendation:** Fix the RLS role mismatch and deploy missing functions first (migration plan), then build admin dashboard screens using Recharts for charts, TanStack Table for data grids, SheetJS for Excel export, and Sonner for toast notifications. All data access goes through the existing Supabase auto-API + RPCs with TanStack Query.

---

## Standard Stack

### Core (Already Installed in Phase 9)
| Library | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `next` | 16.1.6 | App Router framework | `@upoe/admin` (installed) |
| `@supabase/ssr` | ^0.8.0 | Cookie-based Supabase auth | `@upoe/admin` (installed) |
| `@supabase/supabase-js` | ^2.95.3 | Supabase JS client | `@upoe/admin` (installed) |
| `@tanstack/react-query` | ^5.90.20 | Server state management | `@upoe/admin` (installed) |
| `tailwindcss` | ^4 | Styling (v4, NOT v3) | `@upoe/admin` (installed) |
| `@upoe/shared` | workspace:* | Shared types, validators, query keys | `@upoe/admin` (installed) |

### New Dependencies for Phase 11
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `recharts` | ^3.7.0 | Bar, line, pie charts for KPI dashboards | Most popular React charting library (24.8K GitHub stars), built on D3+React, SVG-based, responsive, well-documented |
| `@tanstack/react-table` | ^8.21 | Data tables with sorting, filtering, pagination | From same ecosystem as react-query, headless (BYO styling with Tailwind), supports server-side operations |
| `xlsx` | ^0.18.5 | Excel export for balance reports | SheetJS community edition, client-side XLSX generation, no server processing needed |
| `sonner` | ^2.0.7 | Toast notifications for approve/reject/save feedback | Opinionated React toast, Tailwind-compatible, used by OpenAI/Adobe, tiny bundle |
| `date-fns` | ^4.1 | Date formatting/manipulation for charts and reports | Tree-shakable, already a dependency pattern in the project |

**Confidence:** HIGH -- versions verified on npm as of 2026-02-08.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Recharts | Tremor | Tremor provides pre-built KPI cards BUT adds Radix UI dependency and is more opinionated; Recharts gives more control for custom chart designs |
| Recharts | Nivo | More chart types but larger bundle and steeper learning curve |
| @tanstack/react-table | Raw Supabase queries + manual HTML tables | Works for simple tables but lacks sorting/filtering/pagination primitives that scale |
| xlsx (SheetJS) | ExcelJS | ExcelJS is more powerful but larger; SheetJS CE is sufficient for export-only use case |
| sonner | react-hot-toast | Both work; Sonner has better defaults and is newer/more maintained |

### Installation
```bash
cd packages/admin
pnpm add recharts @tanstack/react-table xlsx sonner date-fns
```

---

## Architecture Patterns

### Recommended Project Structure

```
packages/admin/src/
  app/
    (dashboard)/
      layout.tsx              # Existing sidebar layout (from Phase 9)
      page.tsx                 # Financial overview dashboard (AFIN-01, AFIN-02)
      finances/
        page.tsx               # Balance reports (AFIN-03)
        approvals/
          page.tsx             # Payment proof approval queue (AFIN-04)
        charges/
          page.tsx             # Charge generation with preview (AFIN-05, AFIN-06)
        delinquency/
          page.tsx             # Delinquency analytics (AFIN-07)
        reports/
          page.tsx             # Income vs expense, budget vs actual (AFIN-08)
      residents/
        page.tsx               # Resident list with CRUD (ARES-01)
        [id]/
          page.tsx             # Resident detail/edit
        invite/
          page.tsx             # Invite resident via email (ARES-02)
      units/
        page.tsx               # Unit list with management (ARES-04)
        [id]/
          page.tsx             # Unit detail with occupancy management (ARES-03)
      settings/
        page.tsx               # Community settings (ACONF-01)
        features/
          page.tsx             # Feature flags (ACONF-02)
        roles/
          page.tsx             # Role management (ARES-05)
  components/
    ui/                        # Reusable UI primitives
      Button.tsx
      Card.tsx
      DataTable.tsx            # TanStack Table wrapper
      Modal.tsx
      Badge.tsx
      Select.tsx
      Input.tsx
      Textarea.tsx
    charts/                    # Recharts wrapper components
      KPICard.tsx              # Single KPI metric card
      BarChart.tsx             # Collection bar chart
      LineChart.tsx            # Delinquency trend line
      PieChart.tsx             # Expense breakdown pie
    financial/                 # Domain-specific components
      PaymentProofCard.tsx     # Proof detail with approve/reject
      ChargePreviewTable.tsx   # Preview of generated charges
      BalanceReportTable.tsx   # Unit balance data table
    residents/                 # Resident domain components
      ResidentForm.tsx
      OccupancyManager.tsx
  hooks/
    useAuth.ts                 # Existing (from Phase 9)
    useRole.ts                 # Existing (from Phase 9)
    useFinancials.ts           # KPI queries, balance queries
    usePaymentProofs.ts        # Approval queue queries + mutations
    useCharges.ts              # Charge generation queries + mutations
    useResidents.ts            # Resident CRUD queries + mutations
    useUnits.ts                # Unit queries + mutations
    useOccupancies.ts          # Occupancy management
    useCommunitySettings.ts    # Settings queries + mutations
  lib/
    supabase/                  # Existing 4-file structure (from Phase 9)
      client.ts
      server.ts
      proxy.ts
      admin.ts
    export.ts                  # Excel export utility using SheetJS
    formatters.ts              # Currency, date, percentage formatters
```

### Pattern 1: Data Fetching with TanStack Query + Supabase Auto-API

**What:** All data access uses TanStack Query hooks wrapping Supabase client calls. Server components fetch initial data; client components manage mutations and real-time updates.
**When to use:** Every data-fetching screen in the admin dashboard.
**Confidence:** HIGH -- this is the established pattern from Phase 9/10.

```typescript
// hooks/useFinancials.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export function useKPIMonthly(year: number, month: number) {
  const { communityId } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: queryKeys.kpis.summary(communityId!, `${year}-${month}`).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kpi_monthly')
        .select('*')
        .eq('community_id', communityId!)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

export function useUnitBalances() {
  const { communityId } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ['unit-balances', communityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('unit_balances')
        .select('*')
        .eq('community_id', communityId!)
        .order('unit_number');

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

export function useDelinquentUnits(minDays = 1) {
  const { communityId } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ['delinquent-units', communityId, minDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_delinquent_units', {
        p_community_id: communityId!,
        p_min_days: minDays,
      });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}
```

### Pattern 2: Mutation with Optimistic Toast Feedback

**What:** Mutations (approve, reject, save) use TanStack Query mutations with Sonner toast for user feedback.
**When to use:** Every admin action that modifies data.

```typescript
// hooks/usePaymentProofs.ts
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export function useApprovePaymentProof() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (proofId: string) => {
      const { data, error } = await supabase
        .from('payment_proofs')
        .update({
          status: 'approved',
          reviewed_by: user!.id,
        })
        .eq('id', proofId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Comprobante aprobado');
      queryClient.invalidateQueries({ queryKey: ['payment-proofs'] });
      queryClient.invalidateQueries({ queryKey: ['unit-balances'] });
    },
    onError: (error) => {
      toast.error('Error al aprobar: ' + error.message);
    },
  });
}
```

### Pattern 3: Recharts Client Components with Server Data

**What:** Chart components are `'use client'` but receive data from parent hooks or server-fetched props.
**When to use:** All chart visualizations (bar, line, pie).
**Confidence:** HIGH -- Recharts requires DOM access, must be client-rendered.

```typescript
// components/charts/CollectionChart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface CollectionChartProps {
  data: Array<{
    month: string;
    billed: number;
    collected: number;
  }>;
}

export function CollectionChart({ data }: CollectionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip
          formatter={(value: number) =>
            new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(value)
          }
        />
        <Legend />
        <Bar dataKey="billed" name="Facturado" fill="#6366f1" />
        <Bar dataKey="collected" name="Cobrado" fill="#22c55e" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 4: TanStack Table with Supabase Server-Side Pagination

**What:** Headless data table with sorting, filtering, pagination delegated to Supabase PostgREST.
**When to use:** Balance reports, resident lists, transaction lists -- any paginated table.

```typescript
// components/ui/DataTable.tsx
'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[];
  data: T[];
  pageCount: number;
  onPaginationChange: (pagination: PaginationState) => void;
  onSortingChange: (sorting: SortingState) => void;
  pagination: PaginationState;
  sorting: SortingState;
}

export function DataTable<T>({
  columns,
  data,
  pageCount,
  onPaginationChange,
  onSortingChange,
  pagination,
  sorting,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination, sorting },
    onPaginationChange: (updater) => {
      const next = typeof updater === 'function' ? updater(pagination) : updater;
      onPaginationChange(next);
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' ? ' ↑' : ''}
                  {header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Pagination controls */}
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
        <span className="text-sm text-gray-600">
          Pagina {pagination.pageIndex + 1} de {pageCount}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Pattern 5: Excel Export Utility

**What:** Client-side Excel generation from table data using SheetJS.
**When to use:** Balance reports export (AFIN-03).

```typescript
// lib/export.ts
import * as XLSX from 'xlsx';

export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Datos'
) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
```

### Pattern 6: Charge Generation with Preview (AFIN-05, AFIN-06)

**What:** Admin previews charges before committing. Preview is read-only calculation; apply calls `record_charge` for each unit.
**When to use:** Monthly charge generation workflow.

```typescript
// hooks/useCharges.ts - preview pattern
export function useChargePreview(feeStructureId?: string) {
  const { communityId } = useAuth();
  const supabase = createClient();

  return useQuery({
    queryKey: ['charge-preview', communityId, feeStructureId],
    queryFn: async () => {
      // 1. Get all active units
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, building, coefficient, unit_type')
        .eq('community_id', communityId!)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('unit_number');

      // 2. For each unit, calculate fee amount via RPC
      const previews = await Promise.all(
        (units ?? []).map(async (unit) => {
          const { data } = await supabase.rpc('get_unit_fee_amount', {
            p_unit_id: unit.id,
            p_fee_structure_id: feeStructureId!,
          });
          return {
            ...unit,
            calculated_amount: data ?? 0,
          };
        })
      );

      return previews;
    },
    enabled: !!communityId && !!feeStructureId,
  });
}
```

### Anti-Patterns to Avoid

- **Never bypass RLS from client components.** Always use `createClient()` (browser) for client-side queries. Use `createAdminClient()` (service_role) ONLY in Server Actions and Route Handlers when admin operations require bypassing RLS.
- **Never render Recharts in Server Components.** Charts require the DOM. Always wrap in `'use client'` components.
- **Never store bulk data in React state.** Use TanStack Query for server state management. Component state is only for UI state (open/closed modals, selected items, form values).
- **Never fetch all records without pagination.** Use Supabase `.range()` for large datasets (transactions, residents). Small reference tables (fee_structures, accounts) can be fetched entirely.
- **Never call `getSession()` on the server.** Always use `getClaims()` for JWT validation (established in Phase 9).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Data tables with sorting/filtering | Custom `<table>` with manual sort logic | `@tanstack/react-table` | Column definitions, pagination state, sorting state are complex to manage correctly |
| Charts and graphs | Canvas/SVG from scratch | `recharts` | D3 bindings, responsive containers, tooltips, animations -- hundreds of edge cases |
| Excel file generation | CSV with string concatenation | `xlsx` (SheetJS) | Proper XLSX format, cell types, column widths, sheet naming |
| Toast notifications | Custom div with setTimeout | `sonner` | Animation, stacking, promise toasts, accessibility |
| Currency formatting | Manual string formatting | `Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })` | Handles thousands separator, decimal precision, currency symbol placement per locale |
| Date formatting | Manual date string manipulation | `date-fns` format/formatDistanceToNow | Timezone handling, locale support, tree-shakable |
| Form validation | Manual if/else chains | `zod` schemas (already in shared) | Type inference, composable, shared between client and server |
| Double-entry accounting | Manual INSERT into transactions + ledger_entries | `record_payment()` / `record_charge()` RPCs | Balance validation, reference number generation, account lookups already handled |

**Key insight:** The database already has all the financial logic built (double-entry, balance calculations, KPI aggregation, fee calculation). The admin dashboard is primarily a **presentation and workflow layer** -- it reads existing views/RPCs and calls existing functions. Very little new backend logic is needed.

---

## Common Pitfalls

### Pitfall 1: RLS Role Mismatch (CRITICAL - BLOCKING)
**What goes wrong:** Admin users with JWT role `'community_admin'` are denied access to financial tables because RLS policies check for role `'admin'`.
**Why it happens:** The RLS policies were created with the role name `'admin'` but the `handle_new_user` trigger and `complete_admin_onboarding` function set the JWT role as `'community_admin'`.
**How to avoid:** Fix RLS policies in a migration BEFORE building any dashboard screens. Update all policies on `payment_proofs`, `transactions`, `residents`, `units`, `occupancies`, `fee_structures`, `budgets`, `budget_lines`, `communities` to check for `'community_admin'` instead of (or in addition to) `'admin'`.
**Affected tables and policies:**
| Table | Policy | Current Check | Should Be |
|-------|--------|---------------|-----------|
| `payment_proofs` | `admins_update_payment_proofs` | `'admin'` | `'community_admin'` |
| `payment_proofs` | `admins_view_community_payment_proofs` | `'admin'` | `'community_admin'` |
| `transactions` | `admins_manage_transactions` | `'admin'` | `'community_admin'` |
| `residents` | `admins_manage_residents` | `'admin'` | `'community_admin'` |
| `units` | `admins_manage_units` | `'admin'` | `'community_admin'` |
| `occupancies` | `admins_manage_occupancies` | `'admin'` | `'community_admin'` |
| `fee_structures` | `admins_manage_fee_structures` | `'admin'` | `'community_admin'` |
| `budgets` | `admins_manage_budgets` | `'admin'` | `'community_admin'` |
| `budget_lines` | `admins_manage_budget_lines` | `'admin'` | `'community_admin'` |
| `communities` | `admins_update_own_community` | `'admin'` | `'community_admin'` |
| `community_settings` | `community_settings_update_policy` | `'admin'` (+ `'community_admin'`) | Already has both, OK |
| `community_settings` | `community_settings_insert_policy` | `'community_admin'` | OK |

**Warning signs:** All Supabase queries from the admin dashboard return empty arrays or 403 errors.

### Pitfall 2: Missing `record_payment` / `record_charge` Functions (CRITICAL)
**What goes wrong:** The `on_payment_proof_approved` trigger calls `public.record_payment()` which does not exist in the live database. Approving a payment proof will fail with "function record_payment does not exist."
**Why it happens:** The migration `20260129191023_record_payment_charge.sql` exists in the migrations folder but was apparently not applied to the live database, or was applied and then dropped.
**How to avoid:** Deploy these functions in a migration at the start of Phase 11. The function definitions exist in `supabase/migrations/20260129191023_record_payment_charge.sql`.
**Functions to deploy:** `generate_transaction_reference`, `record_payment`, `record_charge`.
**Warning signs:** Approving a payment proof throws a database error.

### Pitfall 3: Recharts in Server Components
**What goes wrong:** Build error or hydration mismatch when trying to render Recharts in a Server Component.
**Why it happens:** Recharts uses D3 internally which requires DOM access (browser-only API).
**How to avoid:** Always add `'use client'` directive to any component that imports from `recharts`. Fetch data in hooks or parent server components; pass data as props to chart client components.
**Warning signs:** `ReferenceError: document is not defined` during build or SSR.

### Pitfall 4: `force-dynamic` on Dashboard Pages
**What goes wrong:** Build fails or pages show stale data because Next.js tries to statically prerender pages that depend on auth state.
**Why it happens:** The existing dashboard page uses `export const dynamic = 'force-dynamic'` because auth-dependent pages cannot be statically generated.
**How to avoid:** Add `export const dynamic = 'force-dynamic'` to every page under `(dashboard)/` that uses `useAuth()` or reads from Supabase based on the user's `community_id`. Alternatively, make the page a client component (`'use client'`) since all pages use TanStack Query hooks.
**Warning signs:** Build errors about "Dynamic server usage" or empty data in production.

### Pitfall 5: Bulk Operations Performance
**What goes wrong:** Approving 50 payment proofs one-by-one creates 50 sequential requests, each triggering `on_payment_proof_approved` which calls `record_payment`.
**Why it happens:** No bulk approval endpoint exists.
**How to avoid:** For bulk approve, use `Promise.allSettled()` to parallelize or create a dedicated RPC function. Show progress indicator to user during bulk operations. Invalidate queries once at the end, not per item.
**Warning signs:** UI freezes during bulk approval; timeout errors.

### Pitfall 6: Charge Generation Without Preview Confirmation
**What goes wrong:** Admin accidentally generates charges for all units without reviewing amounts first.
**Why it happens:** No confirmation step between preview and apply.
**How to avoid:** Two-step workflow: (1) Preview shows calculated amounts per unit in a table, (2) Admin confirms, (3) Backend applies charges. Use a confirmation modal before `record_charge` calls.
**Warning signs:** Duplicate charges, incorrect amounts, no undo mechanism.

### Pitfall 7: `residents.id` is NOT `auth.uid()`
**What goes wrong:** Code tries to use `residents.id` as the auth user ID.
**Why it happens:** `residents.id` is a business ID (UUID v7). The `residents.user_id` column links to `auth.users.id`.
**How to avoid:** Always use `residents.user_id` for auth linking. When inviting a new resident, `user_id` is NULL until they sign up and the `handle_new_user` trigger links them via email.
**Warning signs:** Foreign key violations, empty query results when joining on wrong column.

---

## Code Examples

### KPI Card Component
```typescript
// components/charts/KPICard.tsx
'use client';

interface KPICardProps {
  title: string;
  value: string;
  change?: number; // percentage change
  changeLabel?: string;
  icon?: React.ReactNode;
}

export function KPICard({ title, value, change, changeLabel, icon }: KPICardProps) {
  const isPositive = (change ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <p className={`mt-1 text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{change.toFixed(1)}%
          {changeLabel && <span className="text-gray-500"> {changeLabel}</span>}
        </p>
      )}
    </div>
  );
}
```

### Currency Formatter
```typescript
// lib/formatters.ts
const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number): string {
  return mxnFormatter.format(amount);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}
```

### Payment Proof Approval Card
```typescript
// components/financial/PaymentProofCard.tsx
'use client';

import { formatCurrency, formatDate } from '@/lib/formatters';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface PaymentProofCardProps {
  proof: {
    id: string;
    proof_type: string;
    amount: number;
    payment_date: string;
    reference_number: string | null;
    bank_name: string | null;
    document_url: string;
    submitter_notes: string | null;
    units: { unit_number: string } | null;
  };
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  isLoading?: boolean;
}

export function PaymentProofCard({ proof, onApprove, onReject, isLoading }: PaymentProofCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-gray-900">
            {proof.units?.unit_number ?? 'Sin unidad'} - {formatCurrency(proof.amount)}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {proof.proof_type} | {formatDate(proof.payment_date)}
          </p>
          {proof.reference_number && (
            <p className="text-sm text-gray-500">Ref: {proof.reference_number}</p>
          )}
          {proof.bank_name && (
            <p className="text-sm text-gray-500">Banco: {proof.bank_name}</p>
          )}
        </div>
        <a
          href={proof.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-indigo-600 hover:text-indigo-500"
        >
          Ver comprobante
        </a>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => onApprove(proof.id)}
          disabled={isLoading}
          className="bg-green-600 text-white hover:bg-green-700"
        >
          Aprobar
        </Button>
        <Button
          onClick={() => {
            const reason = prompt('Motivo del rechazo:');
            if (reason) onReject(proof.id, reason);
          }}
          disabled={isLoading}
          className="bg-red-600 text-white hover:bg-red-700"
        >
          Rechazar
        </Button>
      </div>
    </div>
  );
}
```

### Resident Invite via Supabase Auth Admin API
```typescript
// For ARES-02: Invite resident via email
// This must use a Server Action or Route Handler with createAdminClient()
// because inviting users requires the service_role key

// app/(dashboard)/residents/invite/actions.ts
'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function inviteResident(formData: {
  email: string;
  firstName: string;
  paternalSurname: string;
  unitId: string;
  occupancyType: 'owner' | 'tenant' | 'authorized';
}) {
  // 1. Get current admin's community_id from their JWT
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const communityId = user?.app_metadata?.community_id;

  if (!communityId) throw new Error('No community_id in JWT');

  const admin = createAdminClient();

  // 2. Create resident record (onboarding_status = 'invited')
  const { data: resident, error: resError } = await admin
    .from('residents')
    .insert({
      community_id: communityId,
      email: formData.email,
      first_name: formData.firstName,
      paternal_surname: formData.paternalSurname,
      onboarding_status: 'invited',
      invited_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (resError) throw resError;

  // 3. Create occupancy linking resident to unit
  const { error: occError } = await admin
    .from('occupancies')
    .insert({
      community_id: communityId,
      unit_id: formData.unitId,
      resident_id: resident.id,
      occupancy_type: formData.occupancyType,
    });

  if (occError) throw occError;

  // 4. Send invitation email via Supabase Auth
  // When the user signs up with this email, handle_new_user trigger links them
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    formData.email,
    { data: { community_id: communityId } }
  );

  if (inviteError) throw inviteError;

  return { success: true, residentId: resident.id };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getSession()` for server auth | `getClaims()` with JWKS validation | Supabase SSR v0.8+ | Security: getClaims validates JWT signature, getSession trusts client |
| Tailwind CSS v3 with config file | Tailwind CSS v4 with `@import "tailwindcss"` | 2025 | No `tailwind.config.js` needed; `@theme` blocks replace config |
| Manual chart building with D3 | Recharts v3 with React 19 support | Recharts 3.x (2025) | Better tree-shaking, React 19 compatibility, smaller bundle |
| `xlsx` community edition | Still `xlsx` CE (SheetJS) | Stable | Pro version exists but CE is sufficient for export-only |
| React Table v7 (hooks) | TanStack Table v8 (framework-agnostic) | 2023 | Headless, better TypeScript, works with any CSS framework |

**Deprecated/outdated:**
- `react-chartjs-2`: Canvas-based, heavier than SVG-based Recharts for typical admin dashboards
- `react-table` v7: Replaced by `@tanstack/react-table` v8
- `file-saver`: Not needed -- SheetJS `writeFile` handles downloads directly
- `getSession()` on server: Insecure -- always use `getClaims()`

---

## Database Schema Reference

This section documents the complete schema relevant to Phase 11, verified against the live database.

### Financial Tables

**`transactions`** - Core financial transaction record
- `id`, `community_id`, `transaction_type` (charge/payment/adjustment/interest/reversal/transfer)
- `reference_number`, `description`, `unit_id`, `resident_id`, `amount`, `currency` (default MXN)
- `status` (pending/posted/voided), `posted_at`, `posted_by`
- `effective_date`, `reverses_transaction_id`, `reversed_by_transaction_id`

**`ledger_entries`** - Double-entry bookkeeping
- `id`, `community_id`, `transaction_id`, `account_id`, `amount`, `balance_after`, `entry_sequence`
- Immutable (trigger prevents modification once created)

**`accounts`** - Chart of accounts (GL)
- `id`, `community_id`, `account_number`, `name`, `category` (asset/liability/equity/income/expense)
- `subtype` (cash/accounts_receivable/maintenance_fees/etc.), `parent_account_id`, `depth`
- `current_balance`, `normal_balance`, `is_operating_fund`, `is_reserve_fund`

**`payment_proofs`** - Submitted payment evidence
- `id`, `community_id`, `payment_id` (linked after approval), `unit_id`
- `proof_type`, `amount`, `payment_date`, `reference_number`, `bank_name`
- `document_url`, `status` (pending/approved/rejected/cancelled/expired)
- `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `rejection_reason`

**`fee_structures`** - Fee definitions (maintenance, assessments)
- `id`, `community_id`, `name`, `code`, `calculation_type` (fixed/coefficient/hybrid/tiered/custom)
- `base_amount`, `coefficient_amount`, `frequency` (monthly/bimonthly/quarterly/etc.)
- `income_account_id`, `receivable_account_id`, `applicable_unit_types`

**`fee_schedules`** - Per-unit fee overrides
- `id`, `community_id`, `fee_structure_id`, `unit_id`, `override_amount`, `override_reason`

**`budgets`** / **`budget_lines`** - Budget tracking
- Budget: `fiscal_year`, `period_start/end`, `status` (draft/approved/active/closed), `total_income`, `total_expense`
- Lines: `budget_id`, `account_id`, `budgeted_amount`, `actual_amount`, `variance`

### Views (Computed, Read-Only)

**`unit_balances`** - Per-unit financial summary (VIEW)
- Joins `units` + `transactions` + `ledger_entries` to compute: `total_receivable`, `total_charges`, `total_payments`, `total_interest`, `days_overdue`, `oldest_unpaid_date`, `last_payment_date`

**`account_ledger`** - Ledger entries with account/transaction details (VIEW)
- Joins `ledger_entries` + `accounts` + `transactions` for reporting

### KPI Tables

**`kpi_monthly`** - Pre-computed monthly metrics
- Financial: `total_billed`, `total_collected`, `collection_rate`, `collection_rate_change`
- Delinquency: `units_delinquent_30_days`, `_60_days`, `_90_days`, `total_delinquent_amount`
- Computed via `compute_monthly_kpis(community_id, year, month)` RPC

**`kpi_daily`** - Daily operational metrics
- `payments_received`, `payments_amount`, `new_charges_count`, `units_delinquent`

### Resident/Unit Tables

**`residents`** - Resident profiles
- `id` (business ID, NOT auth.uid), `user_id` (FK to auth.users, nullable until sign-up)
- `community_id`, names (`first_name`, `paternal_surname`, `maternal_surname`), `email`, `phone`
- `onboarding_status` (invited/registered/verified/active/suspended/inactive)
- KYC fields, emergency contacts, notification preferences

**`units`** - Physical units
- `id`, `community_id`, `unit_number`, `unit_type` (casa/departamento/local/bodega/oficina/terreno/estacionamiento)
- `area_m2`, `floor_number`, `building`, `coefficient` (for fee calculation), `parking_spaces`

**`occupancies`** - Unit-resident assignments
- `unit_id`, `resident_id`, `occupancy_type` (owner/tenant/authorized/employee)
- `start_date`, `end_date`, `status`

### Community Configuration

**`community_settings`** - Per-community configuration
- Office hours, contact info, branding (logo_url, primary_color, secondary_color)
- `feature_flags` (JSONB), quiet hours, package settings, pet policy, custom_rules

**`communities`** - Community master record
- Name, slug, description, status, timezone, locale, currency
- Logo, cover image, primary/secondary colors, settings (JSONB)

### Existing RPCs

| Function | Purpose | Returns |
|----------|---------|---------|
| `get_unit_balance(unit_id)` | Get unit's financial summary | `current_balance`, `days_overdue`, `last_payment_date`, totals |
| `get_delinquent_units(community_id, min_days, min_amount)` | List overdue units | Table of unit_id, unit_number, building, total_receivable, days_overdue |
| `calculate_fee_amount(fee_structure_id, unit_id)` | Calculate fee for unit | `money_amount` (numeric) |
| `get_unit_fee_amount(unit_id, fee_structure_id, as_of_date)` | Fee with schedule override | `money_amount` |
| `compute_monthly_kpis(community_id, year, month)` | Compute and upsert monthly KPIs | UUID of kpi_monthly row |

### Functions That MUST Be Deployed (Missing from Live DB)

| Function | Migration File | Purpose |
|----------|---------------|---------|
| `generate_transaction_reference(community_id, prefix, date)` | `20260129191023_record_payment_charge.sql` | Generate sequential references like PAY-2026-00001 |
| `record_payment(community_id, unit_id, amount, date, description, method_id, created_by)` | Same | Record payment with double-entry ledger entries |
| `record_charge(community_id, unit_id, amount, date, description, fee_structure_id, created_by)` | Same | Record charge with double-entry ledger entries |

---

## Open Questions

### 1. Bulk Charge Generation RPC
- **What we know:** `record_charge` creates a single charge. Monthly charge generation needs to create charges for all active units.
- **What's unclear:** Should we create a dedicated `generate_monthly_charges(community_id, fee_structure_id, charge_date)` RPC that loops through units, or call `record_charge` per unit from the client?
- **Recommendation:** Create a server-side RPC for bulk charge generation to ensure atomicity (all-or-nothing transaction). If one unit fails, roll back all. The client should only call one RPC, not N individual calls.

### 2. Email Invite Delivery
- **What we know:** Supabase Auth `admin.inviteUserByEmail()` sends a magic link email. The `handle_new_user` trigger links the user via email match.
- **What's unclear:** Does the current Supabase project have custom email templates configured? Is SMTP set up?
- **Recommendation:** Test invite flow manually. If default Supabase email templates are acceptable, proceed. Otherwise, configure email templates in Supabase dashboard.

### 3. Delinquency Aging Buckets
- **What we know:** `kpi_monthly` has `units_delinquent_30_days`, `_60_days`, `_90_days`. The `compute_monthly_kpis` function tries to use `oldest_charge_date` from `unit_balances` view, but the view has `oldest_unpaid_date` instead. The function has a fallback for this mismatch.
- **What's unclear:** Whether the 120+ day bucket (mentioned in AFIN-07) needs to be added to `kpi_monthly` or computed on the fly from `unit_balances`.
- **Recommendation:** Query `unit_balances` view directly for the delinquency analytics page (AFIN-07) to get real-time data with custom aging buckets (30/60/90/120+). Use `kpi_monthly` for the overview dashboard (AFIN-01) where pre-computed monthly snapshots are appropriate.

### 4. Feature Flags Schema
- **What we know:** `community_settings.feature_flags` is a JSONB column defaulting to `'{}'::jsonb`. No predefined schema for which flags exist.
- **What's unclear:** What feature flags should be available? The requirements (ACONF-02) say "manage feature flags per community" but don't specify which flags.
- **Recommendation:** Define a TypeScript interface for known flags (e.g., `enable_payments`, `enable_visitors`, `enable_packages`, `enable_amenities`) and use it for the feature flags management UI. Store as `{ [flag: string]: boolean }` in the JSONB column. Unknown flags are ignored.

---

## Sources

### Primary (HIGH confidence)
- Live Supabase database inspection via `execute_sql` -- ALL table schemas, views, functions, RLS policies, and enum values verified directly
- Existing codebase: `packages/admin/src/` (Phase 9 layout, hooks, providers, Supabase clients)
- Existing codebase: `packages/shared/src/` (query keys, roles, routes, validators)
- Existing codebase: `packages/mobile/src/hooks/` (established TanStack Query patterns)
- Phase 9 RESEARCH.md and VERIFICATION.md (auth patterns, stack decisions)
- Phase 10 VERIFICATION.md (mobile payment proof submission confirmed)
- Migration file `20260129191023_record_payment_charge.sql` (record_payment/record_charge definitions)

### Secondary (MEDIUM confidence)
- [Recharts npm](https://www.npmjs.com/package/recharts) -- v3.7.0 verified
- [Sonner npm](https://www.npmjs.com/package/sonner) -- v2.0.7 verified
- [SheetJS docs](https://docs.sheetjs.com/docs/demos/frontend/react/) -- React integration pattern
- [TanStack Table docs](https://tanstack.com/table/latest/docs/guide/sorting) -- Server-side sorting/pagination

### Tertiary (LOW confidence)
- WebSearch results for ecosystem recommendations -- verified against npm where possible

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries verified on npm, versions confirmed
- Architecture: HIGH -- patterns based on established Phase 9/10 codebase conventions
- Database schema: HIGH -- verified by direct SQL queries against live database
- Pitfalls: HIGH -- RLS mismatch and missing functions confirmed by live database inspection
- Charting: MEDIUM -- Recharts v3 patterns from official docs + community guides

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable stack, no fast-moving dependencies)
