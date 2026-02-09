# Phase 15: Admin Governance & Analytics - Research

**Researched:** 2026-02-08
**Domain:** Admin governance UI (elections, assemblies, surveys, violations, emergency contacts, keys/devices), guard performance analytics, and audit trail visualization
**Confidence:** HIGH

## Summary

Phase 15 brings the final admin dashboard features for governance, violations management, emergency preparedness, asset tracking, and analytics. The database schema from Phase 8 already provides elections with coefficient-weighted voting, assemblies with Mexican quorum rules, violations with appeals workflow, emergency contacts, and comprehensive audit infrastructure. This research focused on seven key questions: (1) how to display election results with real-time quorum tracking in React, (2) patterns for assembly attendance management with proxy delegation UI, (3) violation workflow UI with escalation visualization, (4) emergency contact privacy controls and evacuation list generation, (5) access device inventory lifecycle UI patterns, (6) guard performance KPI visualization with Recharts, and (7) audit trail filtering and search patterns.

The standard approach uses TanStack Table for all list views (elections, violations, devices, audit logs) following established admin patterns, Recharts v3 for guard performance metrics (patrol completion rates, response times, incident handling) matching the financial dashboard style, form wizards for multi-step processes (election creation, violation reporting), status badges with color coding matching existing Badge component patterns (no size prop), and detail drawers or modal dialogs for viewing complex records. Emergency contact management requires privacy-aware displays with role-based access controls, while audit trail visualization benefits from advanced filtering (date range, user, action type, entity) with CSV export capability. The database already handles coefficient-weighted quorum calculations, violation escalation triggers, and device assignment state machines—the UI layer consumes these via Supabase auto-API with lazy client initialization in TanStack Query hooks.

**Primary recommendation:** Follow established admin dashboard patterns—DataTable with server-side pagination for list views, Recharts for analytics charts, form wizards for complex workflows, Badge components for status display (no size prop), and lazy Supabase client in queryFn. Leverage existing query key factory patterns and getClaims() auth helpers. Export functionality should mirror financial reports (CSV for logs, Excel for tabular data).

## Standard Stack

Phase 15 continues the established admin dashboard stack from Phases 11-14.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16 | Admin dashboard framework with App Router | Established in Phase 9, all admin screens use this |
| TanStack Table | 8.20.1+ | DataTable component for elections, violations, devices, audit logs | Already used in 10+ admin screens (access logs, delinquency, etc.) |
| TanStack Query | 5.x | Data fetching with lazy Supabase client | Phase 9 foundation, getClaims() pattern established |
| Recharts | 3.x | Guard performance charts (patrol completion, response times) | Already used in Phase 11 financial dashboard |
| Supabase JS | Latest | Auto-API client for governance queries | Phase 9 infrastructure, lazy initialization in queryFn |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| react-hook-form | Multi-step forms | Election creation, violation reporting, device assignment |
| zod | Form validation | Shared package validators for governance entities |
| date-fns | Date formatting | Assembly schedules, violation timestamps, audit trail dates |
| SheetJS (xlsx) | Excel export | Device inventory export, violation reports |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Table | Radix UI Table | TanStack chosen: established pattern in codebase, server-side pagination built-in |
| Recharts | Chart.js | Recharts chosen: already used in financial dashboard, consistent styling |
| Form wizards | Single forms | Wizards chosen: complex workflows (elections, assemblies) benefit from step-by-step UX |
| Modal dialogs | Separate pages | Modals chosen: quick actions (view details, approve/reject) without navigation |

## Architecture Patterns

### Recommended Page Structure

```
packages/admin/src/app/(dashboard)/
  governance/
    elections/
      page.tsx              # Elections list with DataTable
      [id]/page.tsx         # Election detail with results chart
      new/page.tsx          # Election creation wizard
    assemblies/
      page.tsx              # Assemblies list
      [id]/page.tsx         # Assembly detail with attendance
    surveys/
      page.tsx              # Surveys list and creation
  violations/
    page.tsx                # Violations list with filters
    [id]/page.tsx           # Violation detail with timeline
  emergency/
    contacts/page.tsx       # Emergency contacts (privacy-aware)
    medical/page.tsx        # Medical conditions (restricted access)
    evacuation/page.tsx     # Evacuation priority list
  devices/
    page.tsx                # Access device inventory
    [id]/page.tsx           # Device assignment history
  analytics/
    guards/page.tsx         # Guard performance metrics
    audit/page.tsx          # Audit trail viewer
```

### Pattern 1: DataTable with Server-Side Pagination

**What:** TanStack Table with manual pagination, sorting, and filtering via Supabase queries
**When to use:** All list views (elections, violations, devices, audit logs)
**Example:**

```typescript
// Source: Established pattern from access-logs/page.tsx
'use client';

export const dynamic = 'force-dynamic';

import { useState, useMemo } from 'react';
import { type ColumnDef, type PaginationState } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';

export default function ElectionsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });
  const [statusFilter, setStatusFilter] = useState('');

  const { data, isLoading } = useElections({
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    status: statusFilter || undefined,
  });

  const columns: ColumnDef<Election>[] = useMemo(() => [
    {
      accessorKey: 'election_number',
      header: 'Número',
    },
    {
      accessorKey: 'title',
      header: 'Título',
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <Badge variant={statusVariant[row.original.status]}>
          {statusLabel[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'quorum_met',
      header: 'Quórum',
      cell: ({ row }) => (
        row.original.quorum_met ?
          <Badge variant="success">Alcanzado</Badge> :
          <Badge variant="warning">Pendiente</Badge>
      ),
    },
  ], []);

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        data={data?.elections ?? []}
        pageCount={data?.pageCount ?? 1}
        pagination={pagination}
        onPaginationChange={setPagination}
        isLoading={isLoading}
      />
    </div>
  );
}
```

### Pattern 2: Guard Performance Analytics with Recharts

**What:** Recharts BarChart and LineChart for guard KPI visualization
**When to use:** Analytics dashboards (guard performance, patrol metrics)
**Example:**

```typescript
// Source: Established pattern from CollectionChart.tsx
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

interface PatrolCompletionChartProps {
  data: Array<{
    guard_name: string;
    patrols_completed: number;
    patrols_scheduled: number;
    completion_rate: number;
  }>;
}

export function PatrolCompletionChart({ data }: PatrolCompletionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-500">
        Sin datos de patrullaje disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="guard_name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="patrols_completed" name="Completados" fill="#22c55e" radius={[4, 4, 0, 0]} />
        <Bar dataKey="patrols_scheduled" name="Programados" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### Pattern 3: Lazy Supabase Client in Query Hooks

**What:** Initialize Supabase client inside queryFn, not in hook body
**When to use:** All TanStack Query hooks for governance data
**Example:**

```typescript
// Source: Established pattern from Phase 9
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@shared/queries/keys';
import { createClient } from '@/lib/supabase/client';
import { getClaims } from '@/lib/auth';

export function useElections(filters: { status?: string }) {
  return useQuery({
    queryKey: queryKeys.elections.list(getClaims().community_id, filters),
    queryFn: async () => {
      const supabase = createClient(); // Lazy initialization
      let query = supabase
        .from('elections')
        .select('*')
        .eq('community_id', getClaims().community_id)
        .order('created_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status as never);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}
```

### Pattern 4: Privacy-Aware Emergency Contact Display

**What:** Role-based access controls for sensitive medical/emergency data
**When to use:** Emergency contacts, medical conditions, accessibility needs
**Example:**

```typescript
// Source: Database has get_emergency_contacts function with RLS
export function useEmergencyContacts(residentId: string) {
  const claims = getClaims();

  return useQuery({
    queryKey: queryKeys.emergencyContacts.byResident(residentId),
    queryFn: async () => {
      const supabase = createClient();

      // RLS policy enforces access control
      // Only admins, the resident, and authorized guards can view
      const { data, error } = await supabase
        .rpc('get_emergency_contacts', { p_resident_id: residentId });

      if (error) throw error;
      return data;
    },
    // Only fetch if user has permission
    enabled: claims.role === 'community_admin' || claims.resident_id === residentId,
  });
}

// UI display with redacted view for unauthorized users
export function EmergencyContactCard({ contact }) {
  const claims = getClaims();
  const canViewFull = claims.role === 'community_admin';

  return (
    <Card>
      <p className="font-medium">{contact.contact_name}</p>
      <p className="text-sm text-gray-600">{contact.relationship}</p>
      {canViewFull ? (
        <>
          <p className="text-sm">{contact.phone_primary}</p>
          {contact.phone_secondary && <p className="text-sm">{contact.phone_secondary}</p>}
        </>
      ) : (
        <p className="text-xs text-gray-400">Solo visible para administradores</p>
      )}
    </Card>
  );
}
```

### Pattern 5: Multi-Step Form Wizard

**What:** React Hook Form with step navigation for complex workflows
**When to use:** Election creation, violation reporting, assembly scheduling
**Example:**

```typescript
// Source: Common pattern for complex forms
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { electionSchema } from '@shared/validators/governance';

export default function NewElectionPage() {
  const [step, setStep] = useState(1);

  const form = useForm({
    resolver: zodResolver(electionSchema),
    defaultValues: {
      title: '',
      description: '',
      election_type: 'board_election',
      opens_at: '',
      closes_at: '',
      options: [],
    },
  });

  function onSubmit(data: ElectionFormData) {
    // Mutation handled separately
    createElection(data);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {step === 1 && <BasicInfoStep form={form} />}
      {step === 2 && <OptionsStep form={form} />}
      {step === 3 && <ScheduleStep form={form} />}
      {step === 4 && <ReviewStep form={form} />}

      <div className="flex justify-between mt-6">
        {step > 1 && (
          <Button type="button" onClick={() => setStep(step - 1)}>
            Anterior
          </Button>
        )}
        {step < 4 ? (
          <Button type="button" onClick={() => setStep(step + 1)}>
            Siguiente
          </Button>
        ) : (
          <Button type="submit">Crear Elección</Button>
        )}
      </div>
    </form>
  );
}
```

### Anti-Patterns to Avoid

- **Badge size prop:** Badge component has NO size prop—will cause TypeScript errors
- **Supabase client in component body:** Always initialize in queryFn for proper SSR handling
- **Hardcoded enum values:** Use 'as never' cast for Supabase enum values
- **Missing force-dynamic:** Auth-dependent pages need `export const dynamic = 'force-dynamic'`
- **Direct user!.id access in queries:** Use getClaims() for community_id, role checks

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coefficient-weighted voting | Custom vote counting logic | Database `calculate_election_quorum()` function | Phase 8 DB already handles Mexican condominium law (units.coefficient sums to 100%), includes quorum validation |
| Assembly quorum calculation | Frontend percentage math | Database `calculate_assembly_quorum()` function | Phase 8 handles 75%/50%+1/any for 1st/2nd/3rd convocatoria per Mexican law |
| Violation escalation | Manual status updates | Database triggers with `check_escalation_triggers()` | Phase 8 automatically escalates based on offense_number and violation type |
| Access device state machine | Custom status tracking | Database `access_device_assignments` with events table | Phase 8 tracks assigned → lost → replaced lifecycle with history |
| Audit trail | Custom logging tables | Database `audit_log` with triggers on all mutations | Phase 8 infrastructure logs all admin actions via set_audit_fields() |
| Guard performance metrics | Real-time aggregation | Pre-computed summary tables refreshed by pg_cron | Phase 8 `kpi_daily` tables avoid expensive JOIN queries |
| Date range filtering | Client-side filtering | Supabase `.gte()` and `.lte()` queries | Server-side filtering reduces payload, leverages indexes |
| Excel export | Custom XLSX generation | SheetJS library with exportToExcel utility | Already used in financial reports, handles formatting consistently |

**Key insight:** Phase 8 database provides the business logic (quorum rules, escalation triggers, state machines)—the admin UI is a thin presentation layer consuming these via Supabase auto-API.

## Common Pitfalls

### Pitfall 1: Ignoring Existing Query Key Factories

**What goes wrong:** Creating ad-hoc query keys instead of using shared factory
**Why it happens:** Not aware that `queryKeys.elections` already exists in shared package
**How to avoid:** Always import from `@shared/queries/keys` and use the factory pattern
**Warning signs:** String literals in queryKey arrays, cache invalidation not working

```typescript
// BAD - Ad-hoc keys
queryKey: ['elections', communityId]

// GOOD - Factory pattern (already exists)
queryKey: queryKeys.elections.list(communityId)
```

### Pitfall 2: Badge Component Size Prop

**What goes wrong:** TypeScript error—Badge has no size prop
**Why it happens:** Copying from other UI libraries that support size variants
**How to avoid:** Badge only accepts variant prop: 'success' | 'info' | 'warning' | 'danger' | 'neutral'
**Warning signs:** `Property 'size' does not exist on type 'BadgeProps'`

```typescript
// BAD - Will error
<Badge size="sm" variant="success">Active</Badge>

// GOOD - No size prop
<Badge variant="success">Active</Badge>
```

### Pitfall 3: Forgetting 'as never' for Enum Values

**What goes wrong:** TypeScript error on enum assignments to Supabase queries
**Why it happens:** Supabase types are overly strict, require cast
**How to avoid:** Always cast enum string literals with 'as never'
**Warning signs:** `Type '"active"' is not assignable to type 'never'`

```typescript
// BAD - TypeScript error
query.eq('status', 'active')

// GOOD - Cast with 'as never'
query.eq('status', 'active' as never)
```

### Pitfall 4: Not Using getClaims() for Auth Context

**What goes wrong:** Runtime getUser() calls in component body cause re-renders
**Why it happens:** Not aware of established getClaims() helper
**How to avoid:** Use getClaims() synchronously for community_id and role checks
**Warning signs:** Async auth calls in render, waterfall loading states

```typescript
// BAD - Async in component body
const { data: user } = await supabase.auth.getUser();
const communityId = user?.app_metadata.community_id;

// GOOD - Sync helper
const claims = getClaims();
const communityId = claims.community_id;
```

### Pitfall 5: Client-Side Filtering of Large Lists

**What goes wrong:** Loading all violations/devices into memory to filter
**Why it happens:** Temptation to use useMemo for filters instead of server queries
**How to avoid:** Pass filters to query hook, let Supabase handle WHERE clauses
**Warning signs:** Initial load fetches 1000+ rows, slow rendering

```typescript
// BAD - Client-side filtering
const { data: allViolations } = useAllViolations();
const filtered = useMemo(() =>
  allViolations.filter(v => v.status === statusFilter),
  [allViolations, statusFilter]
);

// GOOD - Server-side filtering
const { data: violations } = useViolations({ status: statusFilter });
```

### Pitfall 6: Missing Privacy Controls for Medical Data

**What goes wrong:** Displaying sensitive medical info to unauthorized users
**Why it happens:** Assuming RLS is enough without UI-level privacy awareness
**How to avoid:** Check role before rendering sensitive fields, show redacted view
**Warning signs:** GDPR compliance concerns, no visual distinction for sensitive data

```typescript
// BAD - Always showing full data
<p>{medicalCondition.diagnosis}</p>

// GOOD - Role-based display
{canViewMedical ? (
  <p>{medicalCondition.diagnosis}</p>
) : (
  <p className="text-xs text-gray-400 italic">
    Información confidencial (solo administradores)
  </p>
)}
```

## Code Examples

Verified patterns from existing codebase and database schema:

### Election Results with Quorum Display

```typescript
// Source: Database schema elections table + Phase 11 chart patterns
'use client';

import { useElectionResults } from '@/hooks/useElections';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ElectionDetailPage({ params }: { params: { id: string } }) {
  const { data: election, isLoading } = useElectionResults(params.id);

  if (isLoading) return <div>Cargando...</div>;
  if (!election) return <div>Elección no encontrada</div>;

  const quorumProgress = (election.total_coefficient_voted / election.quorum_required) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{election.title}</h1>
          <p className="text-sm text-gray-500">{election.election_number}</p>
        </div>
        <Badge variant={election.status === 'closed' ? 'success' : 'info'}>
          {election.status}
        </Badge>
      </div>

      {/* Quorum Progress */}
      <Card padding="p-6">
        <h3 className="text-lg font-semibold mb-4">Progreso de Quórum</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${election.quorum_met ? 'bg-green-500' : 'bg-indigo-500'}`}
                style={{ width: `${Math.min(quorumProgress, 100)}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{quorumProgress.toFixed(1)}%</p>
            <p className="text-xs text-gray-500">
              {election.total_coefficient_voted} / {election.quorum_required}
            </p>
          </div>
        </div>
        {election.quorum_met ? (
          <Badge variant="success" className="mt-2">Quórum Alcanzado</Badge>
        ) : (
          <Badge variant="warning" className="mt-2">Quórum Pendiente</Badge>
        )}
      </Card>

      {/* Results Chart */}
      <Card padding="p-6">
        <h3 className="text-lg font-semibold mb-4">Resultados</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={election.options}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="option_text" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="coefficient_votes" name="Votos (Coeficiente)" fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
```

### Violation Timeline with Status Badges

```typescript
// Source: Database violations table + access logs DataTable pattern
'use client';

import { useViolation } from '@/hooks/useViolations';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/formatters';

const severityVariant = {
  minor: 'info' as const,
  moderate: 'warning' as const,
  serious: 'danger' as const,
  critical: 'danger' as const,
};

export function ViolationDetail({ violationId }: { violationId: string }) {
  const { data: violation } = useViolation(violationId);

  if (!violation) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{violation.violation_number}</h2>
          <p className="text-sm text-gray-500">
            Unidad {violation.unit?.unit_number} • {formatDateTime(violation.occurred_at)}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={severityVariant[violation.severity]}>
            {violation.severity}
          </Badge>
          <Badge variant={violation.status === 'resolved' ? 'success' : 'warning'}>
            {violation.status}
          </Badge>
        </div>
      </div>

      {/* Description */}
      <Card padding="p-4">
        <h3 className="font-semibold mb-2">Descripción</h3>
        <p className="text-sm text-gray-700">{violation.description}</p>
      </Card>

      {/* Sanctions */}
      {violation.sanctions && violation.sanctions.length > 0 && (
        <Card padding="p-4">
          <h3 className="font-semibold mb-3">Sanciones Aplicadas</h3>
          <div className="space-y-2">
            {violation.sanctions.map((sanction) => (
              <div key={sanction.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="text-sm font-medium">{sanction.sanction_type}</p>
                  <p className="text-xs text-gray-500">{formatDateTime(sanction.applied_at)}</p>
                </div>
                {sanction.fine_amount && (
                  <p className="text-sm font-bold">${sanction.fine_amount}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Photo Evidence */}
      {violation.photo_urls && violation.photo_urls.length > 0 && (
        <Card padding="p-4">
          <h3 className="font-semibold mb-3">Evidencia Fotográfica</h3>
          <div className="grid grid-cols-3 gap-2">
            {violation.photo_urls.map((url, i) => (
              <img key={i} src={url} alt={`Evidencia ${i + 1}`} className="rounded" />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
```

### Guard Performance Metrics Dashboard

```typescript
// Source: Phase 11 financial dashboard + database kpi_daily tables
'use client';

import { useGuardPerformance } from '@/hooks/useAnalytics';
import { Card } from '@/components/ui/Card';
import { PatrolCompletionChart } from '@/components/charts/PatrolCompletionChart';
import { ResponseTimeChart } from '@/components/charts/ResponseTimeChart';

export default function GuardAnalyticsPage() {
  const { data: metrics, isLoading } = useGuardPerformance({
    dateFrom: '2026-01-01',
    dateTo: '2026-02-08',
  });

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Métricas de Guardias</h1>
        <p className="text-sm text-gray-500">Desempeño y estadísticas del equipo de seguridad</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Total Patrullajes</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {metrics?.total_patrols ?? 0}
          </p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Tasa de Completitud</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {metrics?.completion_rate ?? 0}%
          </p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Tiempo Respuesta Promedio</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">
            {metrics?.avg_response_minutes ?? 0} min
          </p>
        </Card>
        <Card padding="p-4">
          <p className="text-sm font-medium text-gray-500">Incidentes Atendidos</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {metrics?.incidents_handled ?? 0}
          </p>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="p-6">
          <h3 className="text-lg font-semibold mb-4">Patrullajes por Guardia</h3>
          <PatrolCompletionChart data={metrics?.patrol_by_guard ?? []} />
        </Card>

        <Card padding="p-6">
          <h3 className="text-lg font-semibold mb-4">Tiempos de Respuesta</h3>
          <ResponseTimeChart data={metrics?.response_times ?? []} />
        </Card>
      </div>
    </div>
  );
}
```

### Audit Trail Viewer with Filters

```typescript
// Source: Access logs pattern + database audit infrastructure
'use client';

import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { useAuditLogs } from '@/hooks/useAudit';
import { formatDateTime } from '@/lib/formatters';
import { exportToCSV } from '@/lib/export';

interface AuditLogRow {
  id: string;
  timestamp: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes: Record<string, any>;
}

export default function AuditTrailPage() {
  const [dateFrom, setDateFrom] = useState('2026-01-01');
  const [dateTo, setDateTo] = useState('2026-02-08');
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading } = useAuditLogs({
    dateFrom,
    dateTo,
    action: actionFilter || undefined,
  });

  const columns: ColumnDef<AuditLogRow>[] = [
    {
      accessorKey: 'timestamp',
      header: 'Fecha/Hora',
      cell: ({ row }) => formatDateTime(row.original.timestamp),
    },
    {
      accessorKey: 'user_name',
      header: 'Usuario',
    },
    {
      accessorKey: 'action',
      header: 'Acción',
    },
    {
      accessorKey: 'entity_type',
      header: 'Tipo',
    },
    {
      id: 'changes',
      header: 'Cambios',
      cell: ({ row }) => (
        <button
          className="text-sm text-indigo-600 hover:underline"
          onClick={() => showChangesModal(row.original)}
        >
          Ver detalles
        </button>
      ),
    },
  ];

  function handleExport() {
    if (!data?.logs) return;
    const exportData = data.logs.map((log) => ({
      'Fecha/Hora': formatDateTime(log.timestamp),
      Usuario: log.user_name,
      Acción: log.action,
      Tipo: log.entity_type,
      'ID Entidad': log.entity_id,
    }));
    exportToCSV(exportData, 'audit-trail');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Registro de Auditoría</h1>
        <button onClick={handleExport} className="btn-secondary">
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="input"
        >
          <option value="">Todas las acciones</option>
          <option value="create">Crear</option>
          <option value="update">Actualizar</option>
          <option value="delete">Eliminar</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={data?.logs ?? []}
        isLoading={isLoading}
      />
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side quorum calculation | Database functions (calculate_election_quorum) | Phase 8 (Jan 2026) | Server-side ensures Mexican law compliance, handles coefficient weighting correctly |
| Real-time KPI aggregation | Pre-computed summary tables (kpi_daily) | Phase 8 (Jan 2026) | Dashboard loads instantly, pg_cron refreshes overnight |
| Manual violation escalation | Trigger-based escalation | Phase 8 (Jan 2026) | Automatic escalation based on offense_number prevents human error |
| Generic audit logs | Domain-specific audit with typed changes | Phase 8 (Jan 2026) | Structured change tracking makes compliance audits easier |
| Recharts v2 | Recharts v3 | Phase 11 (Jan 2026) | Better TypeScript support, improved performance |
| String query keys | Query key factories | Phase 9 (Jan 2026) | Type-safe cache invalidation, consistent patterns |

**Deprecated/outdated:**
- Manual quorum tracking: Database functions handle this, UI displays results
- Custom state machines for devices: Database assignment history table tracks lifecycle
- Client-side role checks: getClaims() provides server-validated role from JWT

## Open Questions

Things that couldn't be fully resolved:

1. **Access Device Physical Inventory Integration**
   - What we know: Database tracks device assignments with serial numbers, status
   - What's unclear: Physical barcode/RFID scanning workflow for inventory audits
   - Recommendation: Plan for manual entry initially, design schema to support barcode scanning in future phase

2. **Evacuation List PDF Generation**
   - What we know: Database has get_emergency_contacts_for_unit function
   - What's unclear: Server-side PDF generation vs client-side print
   - Recommendation: Start with browser print (window.print()), consider react-pdf for server-side generation if needed

3. **Guard Performance Benchmark Standards**
   - What we know: Can compute patrol completion rates, response times from logs
   - What's unclear: What are "good" vs "poor" benchmarks for Mexican residential security?
   - Recommendation: Display raw metrics first, let admins define their own thresholds based on community needs

4. **Bulk Operations Concurrency**
   - What we know: Bulk charge generation pattern exists from Phase 11
   - What's unclear: PostgreSQL connection limits for bulk notification sending
   - Recommendation: Batch operations in groups of 100, use Promise.all with concurrency limit

## Sources

### Primary (HIGH confidence)
- Existing codebase patterns:
  - `packages/admin/src/app/(dashboard)/operations/access-logs/page.tsx` - DataTable with pagination
  - `packages/admin/src/components/charts/CollectionChart.tsx` - Recharts v3 implementation
  - `packages/admin/src/app/(dashboard)/finances/page.tsx` - KPI dashboard layout
  - `packages/shared/src/queries/keys.ts` - Query key factory (elections keys exist line 125-130)
- Database schema:
  - `supabase/database.types.ts` - elections, assemblies, violations, emergency_contacts, accessibility_needs, medical_conditions tables confirmed
  - Phase 8 database research: `.planning/phases/08-governance-analytics/08-RESEARCH.md` - Comprehensive governance schema patterns

### Secondary (MEDIUM confidence)
- [Next.js & shadcn/ui Admin Dashboard Template](https://vercel.com/templates/next.js/next-js-and-shadcn-ui-admin-dashboard) - Verified 2026 patterns for Next.js 16 dashboards
- [Supabase Postgres Best Practices](https://supaexplorer.com/best-practices/supabase-postgres/) - Bulk operations optimization
- [How to Implement Row-Level Security in PostgreSQL](https://oneuptime.com/blog/post/2026-01-21-postgresql-row-level-security/view) - RLS patterns for privacy-aware displays

### Tertiary (LOW confidence)
- [ReactBlueprint - React Best Practices 2026](https://react-blueprint.dev/) - General React patterns, not governance-specific
- [KPI Dashboard Overview](https://improvado.io/blog/kpi-dashboard) - General dashboard principles, not React-specific
- [Emergency Communication GDPR Compliance](https://www.crises-control.com/blogs/emergency-communication-system-gdpr/) - Privacy principles, not implementation details

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use from previous phases
- Architecture patterns: HIGH - Following established admin dashboard patterns from Phases 11-14
- Database integration: HIGH - Phase 8 schema complete, tables and functions verified in database.types.ts
- Privacy controls: MEDIUM - RLS policies exist, UI-level privacy patterns inferred from best practices
- Guard analytics: MEDIUM - Database has kpi tables, chart patterns established, specific metrics need validation

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days - stable stack, database schema complete)
