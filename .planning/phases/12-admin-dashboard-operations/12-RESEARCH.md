# Phase 12: Admin Dashboard Operations - Research

**Researched:** 2026-02-08
**Domain:** Admin operations dashboard (maintenance tickets, announcements, access logs, documents, amenities) + mobile resident maintenance/announcements screens
**Confidence:** HIGH (verified via live DB inspection, full codebase analysis, existing Phase 11 patterns)

## Summary

Phase 12 builds the operational management screens for the admin dashboard and the corresponding mobile resident screens. It spans five operational domains: maintenance ticketing (table/kanban + SLA metrics), announcements (create, schedule, target, read receipts), access log reports (date/gate filters, CSV export), document repository (upload, categorize, version, set visibility), and amenity management (CRUD, rules, schedules, utilization reports). On the mobile side, residents need to submit maintenance requests with photos, view ticket timelines with comments, and read/acknowledge announcements.

Key findings:
1. **Complete database schema exists** for all five domains: `tickets`, `ticket_categories`, `ticket_assignments`, `ticket_comments`, `sla_definitions` (maintenance); `announcements`, `announcement_recipients` with `expand_announcement_recipients()` function (announcements); `access_logs` immutable table with BRIN indexes (access logs); `documents`, `document_versions`, `document_permissions` with `check_document_access()` and `upload_document_version()` functions (documents); `amenities`, `amenity_rules`, `reservations` with `validate_booking_rules()` and `create_reservation()` functions (amenities).
2. **RLS policies are comprehensive** but have known `residents.id` vs `auth.uid()` mismatches in some policies. The `reporters_update_own_tickets` policy compares `reported_by` against `residents.id = auth.uid()` which is incorrect because `residents.id` is a business UUID, not `auth.uid()`. The `reporters_create_comments` policy has the same issue. The `users_view_own_announcements` policy uses `ar.resident_id = auth.uid()` which also needs the same fix. These were flagged in Phase 10/11 research and may already be addressed, but the planner should verify.
3. **Shared query keys are missing** for `tickets`, `announcements`, and `documents`. Only `accessLogs` and `amenities` have query key factories. New factories must be added to `packages/shared/src/queries/keys.ts`.
4. **Admin sidebar already has navigation placeholders** for `/operations` (wrench icon) and `/reports` (chart icon) but neither route has a page. Phase 12 operations pages should go under `/operations/` with sub-routes.
5. **All admin UI primitives exist**: `DataTable` (TanStack Table wrapper), `Card`, `Badge`, `Button`, `KPICard`, Recharts charts, `exportToExcel()` utility. The pattern is well-established from Phase 11 with paginated lists, search, form modals, and mutations with Sonner toast feedback.

**Primary recommendation:** Follow the exact same admin page patterns from Phase 11 (see Code Examples). Add missing query key factories to shared package. Build admin operations pages under `/operations/` with tickets, announcements, access-logs, documents, and amenities sub-routes. Build mobile screens under `(resident)/maintenance/` and `(resident)/announcements/`. Add CSV export as a thin wrapper around the existing `exportToExcel()` utility. For kanban view, use a simple drag-and-drop implementation with CSS grid columns (no heavy DnD library needed for status-column kanban).

---

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `next` | 16.1.6 | App Router framework | `@upoe/admin` |
| `@supabase/ssr` | ^0.8.0 | Cookie-based Supabase auth | `@upoe/admin` |
| `@supabase/supabase-js` | ^2.95.3 | Supabase JS client | `@upoe/admin` + `@upoe/mobile` |
| `@tanstack/react-query` | ^5.90.20 | Server state management | Both packages |
| `@tanstack/react-table` | ^8.21.3 | Data tables with sorting/filtering/pagination | `@upoe/admin` |
| `recharts` | ^3.7.0 | Charts for SLA metrics and utilization reports | `@upoe/admin` |
| `xlsx` | ^0.18.5 | Excel/CSV export | `@upoe/admin` |
| `sonner` | ^2.0.7 | Toast notifications | `@upoe/admin` |
| `date-fns` | ^4.1.0 | Date formatting | Both packages |
| `tailwindcss` | ^4 (admin) / 3.4.17 (mobile) | Styling | Both packages |
| `nativewind` | ^4.2.1 | Tailwind for React Native | `@upoe/mobile` |
| `expo-image-picker` | ~17.0.10 | Photo selection for ticket attachments | `@upoe/mobile` |
| `@lukemorales/query-key-factory` | ^1.3.4 | Type-safe query keys | `@upoe/shared` |

### New Dependencies (None Required)
No new npm packages are needed. All libraries are already installed. The phase is purely about building new pages and hooks using the existing stack.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid kanban | `@hello-pangea/dnd` or `dnd-kit` | Full DnD library adds complexity; ticket status kanban is simple column layout with click-to-move, not freeform drag |
| SheetJS for CSV | Native `Blob` + manual CSV string | SheetJS already installed and provides both CSV and XLSX with one API |
| Manual date-range picker | `react-day-picker` | Not needed yet; HTML `<input type="date">` used consistently in existing admin pages |

---

## Architecture Patterns

### Recommended Project Structure

```
packages/admin/src/
  app/(dashboard)/
    operations/
      page.tsx                        # Operations overview (redirect to tickets)
      tickets/
        page.tsx                      # AOPS-01: Ticket list (table + kanban toggle)
        [id]/
          page.tsx                    # Ticket detail: assign, update status, comments, SLA
      announcements/
        page.tsx                      # AOPS-04: Announcement list + create form
        [id]/
          page.tsx                    # AOPS-05: Announcement detail + read receipts
      access-logs/
        page.tsx                      # AOPS-06, AOPS-07: Log table + filters + export
      documents/
        page.tsx                      # AOPS-08: Document list by category + upload
      amenities/
        page.tsx                      # AOPS-09: Amenity list + create/edit
        [id]/
          page.tsx                    # AOPS-10: Amenity detail + rules + utilization
  hooks/
    useTickets.ts                     # Ticket queries and mutations
    useAnnouncements.ts               # Announcement queries and mutations
    useAccessLogs.ts                  # Access log queries
    useDocuments.ts                   # Document queries and mutations
    useAmenities.ts                   # Amenity queries and mutations
  components/
    tickets/
      TicketStatusBadge.tsx           # Status badge with color mapping
      TicketKanbanBoard.tsx           # Kanban view component
      TicketSLAIndicator.tsx          # SLA breach/warning indicator
      TicketTimeline.tsx              # Comment/status timeline
    announcements/
      AnnouncementForm.tsx            # Create/edit announcement form
      RecipientTable.tsx              # Read receipt table
    charts/
      SLAChart.tsx                    # SLA metrics chart
      AmenityUtilizationChart.tsx     # Booking rates / peak hours chart

packages/mobile/
  app/(resident)/
    maintenance/
      _layout.tsx                     # Stack layout for maintenance screens
      index.tsx                       # RMAINT-01: Ticket list + create button
      create.tsx                      # RMAINT-01: Create ticket with photos
      [id].tsx                        # RMAINT-02, RMAINT-04: Ticket detail + timeline + comments
    announcements/
      _layout.tsx                     # Stack layout
      index.tsx                       # RCOMM-01: Announcement feed
      [id].tsx                        # RCOMM-02: Announcement detail + mark read
  src/hooks/
    useTickets.ts                     # Mobile ticket queries/mutations
    useAnnouncements.ts               # Mobile announcement queries/mutations

packages/shared/src/
  queries/keys.ts                     # Add: tickets, announcements, documents factories
  validators/
    tickets.ts                        # Zod schemas for ticket creation/update
    announcements.ts                  # Zod schemas for announcement creation
```

### Pattern 1: Admin CRUD Page (Established Pattern)

**What:** DataTable + search + pagination + create form + status badges
**When to use:** All list pages (tickets, announcements, documents, amenities)
**Example:** (from existing `residents/page.tsx`)

```typescript
'use client';
export const dynamic = 'force-dynamic';

import { useState, useMemo, useCallback } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTickets } from '@/hooks/useTickets';

export default function TicketsPage() {
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  const { data, isLoading } = useTickets({ search, ...pagination });

  const columns = useMemo<ColumnDef<Ticket, unknown>[]>(() => [
    // ... column definitions with Badge for status, Link for detail
  ], []);

  return (
    <div className="space-y-6">
      {/* Page header + actions */}
      {/* Search bar */}
      {/* DataTable */}
    </div>
  );
}
```

### Pattern 2: TanStack Query Hook (Established Pattern)

**What:** Custom hook wrapping Supabase query with TanStack Query
**When to use:** Every data-fetching operation
**Example:** (from existing `useResidents.ts`)

```typescript
'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function useTickets(filters: TicketFilters) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.tickets.list(communityId!).queryKey, filters],
    queryFn: async () => {
      const supabase = createClient(); // LAZY: inside queryFn, not hook body
      let query = supabase
        .from('tickets')
        .select('*, ticket_categories!inner(name, icon, color)', { count: 'exact' })
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters...
      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}
```

### Pattern 3: Mobile List + Detail Screen (Established Pattern)

**What:** ScrollView/FlatList with cards linking to detail screens
**When to use:** Resident ticket list, announcement feed
**Example:** (from existing mobile patterns)

```typescript
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export default function MaintenanceListScreen() {
  const router = useRouter();
  const { residentId, communityId } = useAuth();

  const { data: tickets } = useQuery({
    queryKey: queryKeys.tickets.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tickets')
        .select('id, title, status, priority, created_at, ticket_categories(name, icon)')
        .eq('community_id', communityId!)
        .eq('reported_by', residentId!)    // Use residentId, NOT auth.uid()
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!communityId && !!residentId,
  });

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerClassName="p-5 pt-14">
      {/* Ticket cards with status badges */}
    </ScrollView>
  );
}
```

### Pattern 4: File Upload with Supabase Storage (Established Pattern)

**What:** Mobile image picker -> Supabase Storage upload -> save path to DB
**When to use:** Ticket photo attachments
**Example:** (from existing `upload-proof.tsx`)

```typescript
import { pickAndUploadImage } from '@/lib/upload';
import { STORAGE_BUCKETS } from '@upoe/shared';

const handlePickImage = async () => {
  const path = await pickAndUploadImage(
    STORAGE_BUCKETS.TICKET_ATTACHMENTS,  // 'ticket-attachments' bucket exists
    communityId,
    'photos'
  );
  if (path) setPhotoPaths(prev => [...prev, path]);
};
```

### Pattern 5: Excel/CSV Export (Established Pattern)

**What:** Client-side export using SheetJS
**When to use:** Access log export (AOPS-07), any data export
**Example:** (from existing `lib/export.ts`)

```typescript
import { exportToExcel } from '@/lib/export';

function handleExport() {
  const rows = accessLogs.map(log => ({
    'Fecha': formatDate(log.logged_at),
    'Persona': log.person_name,
    'Tipo': log.person_type,
    'Acceso': log.access_point_name,
    'Direccion': log.direction,
    'Metodo': log.method,
    'Decision': log.decision,
  }));
  exportToExcel(rows, `access-logs-${dateRange}`, 'Accesos');
}
```

For CSV specifically, SheetJS supports it:
```typescript
import * as XLSX from 'xlsx';

export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}
```

### Pattern 6: Kanban Board (New Pattern for Phase 12)

**What:** CSS Grid columns grouped by ticket status, with click-to-move actions
**When to use:** AOPS-01 kanban view for maintenance tickets
**Implementation approach:**

```typescript
// Group tickets by status column
const columns = ['open', 'assigned', 'in_progress', 'pending_parts', 'pending_resident', 'resolved'];
const grouped = Object.groupBy(tickets, t => t.status);

// Render as CSS grid columns
<div className="grid grid-cols-6 gap-4 overflow-x-auto">
  {columns.map(status => (
    <div key={status} className="min-w-[250px] rounded-lg bg-gray-100 p-3">
      <h3 className="font-semibold text-sm mb-3">{statusLabels[status]}</h3>
      {(grouped[status] ?? []).map(ticket => (
        <TicketKanbanCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  ))}
</div>
```

No drag-and-drop library needed. Status transitions are done via dropdown/button on each card, which calls the mutation to update ticket status. The validate_ticket_transition trigger enforces valid transitions.

### Anti-Patterns to Avoid

- **Using `auth.uid()` as `reported_by` in mobile ticket creation:** `tickets.reported_by` references `residents.id` which is a business UUID. Use `residentId` from `useAuth()` (which comes from JWT `app_metadata.resident_id`).
- **Fetching all access logs without pagination:** `access_logs` is append-only and grows unboundedly. Always use date-range filters and server-side pagination via `.range(from, to)`.
- **Calling `expand_announcement_recipients()` on the client:** This is a server-side function that does bulk inserts. Call it via `supabase.rpc('expand_announcement_recipients', { p_announcement_id: id })` after inserting the announcement.
- **Modifying access logs:** The `access_logs` table has triggers that RAISE EXCEPTION on UPDATE and DELETE. The table is append-only.
- **Creating tickets without SLA computation:** The `set_ticket_sla_dates` trigger auto-computes `response_due_at` and `resolution_due_at` on INSERT. Do NOT manually set these fields.
- **Creating `createClient()` in hook body:** Always call `createClient()` inside `queryFn` / `mutationFn`, never at the hook level (causes SSR prerender crashes in Next.js).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ticket status transitions | Manual status validation in frontend | DB trigger `validate_ticket_transition()` | 8 states, 15 transitions, server-enforced with RAISE EXCEPTION |
| SLA due date computation | Frontend date math | DB trigger `set_ticket_sla_dates()` + `compute_sla_due_dates()` | Priority-dependent, category-specific, auto-recomputed on priority change |
| Announcement recipient expansion | Frontend loop inserting recipients | DB function `expand_announcement_recipients()` | Handles 7 segment types (all, owners, tenants, building, unit_type, delinquent, role) with batching |
| Announcement read count | Manual count queries | DB trigger `update_announcement_read_count()` | Denormalized counters updated atomically on recipient update |
| Document version numbering | Frontend version tracking | DB trigger `set_document_version()` + `update_document_current_version()` | Auto-increments, links previous version, updates `documents.current_version_id` |
| Booking rule validation | Frontend rule engine | DB function `validate_booking_rules()` | 10 rule types evaluated in priority order, handles quota/advance/duration/blackout/owner-only |
| Reservation overlap detection | Frontend time checks | DB exclusion constraint `reservations_no_overlap` | GiST index with tstzrange overlap detection, impossible to circumvent |
| Access log integrity | Frontend hash computation | DB trigger `compute_access_log_hash()` | SHA-256 hash chain computed on INSERT, immutability enforced by triggers |
| Ticket comment audit trail | Frontend system comments | DB triggers `auto_comment_on_status_change()`, `auto_comment_on_assignment()`, `auto_comment_on_priority_change()` | Automatic system comments on every status/assignment/priority change |

**Key insight:** The database layer handles ALL business logic for these operations. The frontend is purely a UI layer that inserts/updates rows and displays results. Never duplicate validation or computation that the database already handles via triggers and functions.

---

## Common Pitfalls

### Pitfall 1: residents.id vs auth.uid() Identity Mismatch
**What goes wrong:** Frontend code uses `auth.uid()` where `residents.id` (business ID) is expected, causing INSERT/UPDATE failures or empty query results.
**Why it happens:** `residents.id` is a business-generated UUID, not linked to `auth.users.id`. The link is `residents.user_id -> auth.users.id`.
**How to avoid:** Always use `residentId` from `useAuth()` hook (comes from `app_metadata.resident_id` in JWT). When querying tickets reported by current user, filter by `reported_by = residentId`, not `auth.uid()`.
**Warning signs:** Empty ticket lists for logged-in residents, "violates foreign key constraint" errors on ticket creation.

### Pitfall 2: Ticket Status Transition Errors
**What goes wrong:** Admin tries to move ticket from `open` directly to `in_progress`, but the DB trigger rejects it (valid transition is `open -> assigned`).
**Why it happens:** The state machine is enforced server-side via `validate_ticket_transition()` trigger.
**How to avoid:** The frontend must show only valid next-status options. Hardcode the transition map in a shared constant:
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  open: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'open', 'cancelled'],
  in_progress: ['pending_parts', 'pending_resident', 'resolved', 'assigned'],
  pending_parts: ['in_progress', 'cancelled'],
  pending_resident: ['in_progress', 'resolved', 'cancelled'],
  resolved: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};
```
**Warning signs:** 400 errors with message "Invalid ticket status transition from X to Y".

### Pitfall 3: PostgREST Ambiguous FK Joins
**What goes wrong:** Supabase query with `.select('*, ticket_categories(*)')` fails with "Could not embed because more than one relationship was found".
**Why it happens:** PostgREST requires FK hint when a table has multiple FK relationships to the same table, or when the relationship name is ambiguous.
**How to avoid:** Use explicit FK hints: `.select('*, ticket_categories!tickets_category_id_fkey(name, icon)')` or `.select('*, ticket_categories!inner(name)')`.
**Warning signs:** PostgREST 400 error mentioning "more than one relationship" or "could not embed".

### Pitfall 4: Access Logs Cannot Be Updated or Deleted
**What goes wrong:** Attempting to update or soft-delete an access log throws a database exception.
**Why it happens:** `access_logs` has `prevent_access_log_modification()` triggers on both UPDATE and DELETE that RAISE EXCEPTION.
**How to avoid:** Only use INSERT for access logs. For admin views, filter with WHERE clauses (date range, gate, person type) but never attempt to modify or delete records.
**Warning signs:** "access_logs is append-only: UPDATE operations are not allowed" error.

### Pitfall 5: Announcement Recipient Expansion Must Be Called Explicitly
**What goes wrong:** Admin creates an announcement but no recipients are generated, so no one sees it.
**Why it happens:** The `expand_announcement_recipients()` function must be called explicitly after inserting the announcement. It is NOT a trigger.
**How to avoid:** After inserting an announcement, immediately call `supabase.rpc('expand_announcement_recipients', { p_announcement_id: id })`. Then the `total_recipients` count is updated automatically.
**Warning signs:** Announcement created with `total_recipients = 0`, residents don't see it.

### Pitfall 6: Document Upload Requires Two Steps
**What goes wrong:** Admin uploads a file but the document record is incomplete.
**Why it happens:** Documents have a two-table structure: `documents` (metadata) and `document_versions` (file data). The `upload_document_version()` function handles version creation, but the `documents` record must exist first.
**How to avoid:** 1) Upload file to Supabase Storage (`document-files` bucket) 2) Insert into `documents` table 3) Call `upload_document_version()` RPC or insert into `document_versions` directly (trigger auto-sets version number and updates `current_version_id`).
**Warning signs:** Document exists but `current_version_id` is NULL.

---

## Code Examples

### Admin: Fetch Tickets with Filters and Joins
```typescript
// hooks/useTickets.ts
export function useTickets(filters: {
  search?: string;
  status?: string;
  priority?: string;
  page: number;
  pageSize: number;
}) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.tickets.list(communityId!).queryKey, filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('tickets')
        .select(
          `id, title, description, status, priority, created_at,
           response_due_at, resolution_due_at, response_breached, resolution_breached,
           first_responded_at, resolved_at, assigned_to, reported_by,
           ticket_categories(name, icon, color),
           residents!tickets_reported_by_fkey(first_name, paternal_surname, email)`,
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const from = filters.page * filters.pageSize;
      query = query.range(from, from + filters.pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}
```

### Admin: Assign Ticket to Staff
```typescript
export function useAssignTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, assigneeId, notes }: {
      ticketId: string; assigneeId: string; notes?: string;
    }) => {
      const supabase = createClient();
      // Insert assignment record (trigger syncs to tickets.assigned_to)
      const { error } = await supabase
        .from('ticket_assignments')
        .insert({
          ticket_id: ticketId,
          assigned_to: assigneeId,
          assigned_by: (await supabase.auth.getUser()).data.user!.id,
          notes,
        });
      if (error) throw error;

      // Also update ticket status to 'assigned' if currently 'open'
      // The DB trigger validates the transition
      const { error: statusError } = await supabase
        .from('tickets')
        .update({ status: 'assigned' })
        .eq('id', ticketId)
        .eq('status', 'open'); // Only transition if still open
      // Ignore statusError if ticket is already assigned (not in 'open' state)
    },
    onSuccess: () => {
      toast.success('Ticket asignado exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al asignar ticket: ${error.message}`);
    },
  });
}
```

### Admin: Create Announcement with Recipient Expansion
```typescript
export function useCreateAnnouncement() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      body: string;
      target_segment: string;
      target_criteria?: Record<string, unknown>;
      publish_at?: string;
      is_urgent?: boolean;
      requires_acknowledgment?: boolean;
    }) => {
      const supabase = createClient();
      const user = (await supabase.auth.getUser()).data.user!;

      // 1. Insert announcement
      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert({
          community_id: communityId!,
          title: input.title,
          body: input.body,
          target_segment: input.target_segment,
          target_criteria: input.target_criteria ?? null,
          publish_at: input.publish_at ?? new Date().toISOString(),
          is_urgent: input.is_urgent ?? false,
          requires_acknowledgment: input.requires_acknowledgment ?? false,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      // 2. Expand recipients (REQUIRED - not automatic)
      const { data: recipientCount, error: expandError } = await supabase
        .rpc('expand_announcement_recipients', {
          p_announcement_id: announcement.id,
        });
      if (expandError) throw expandError;

      return { ...announcement, total_recipients: recipientCount };
    },
    onSuccess: (data) => {
      toast.success(`Aviso enviado a ${data.total_recipients} destinatarios`);
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements._def });
    },
    onError: (error: Error) => {
      toast.error(`Error al crear aviso: ${error.message}`);
    },
  });
}
```

### Admin: SLA Metrics Computation
```typescript
// Compute SLA metrics from ticket data (client-side aggregation)
export function computeSLAMetrics(tickets: Ticket[]) {
  const total = tickets.length;
  if (total === 0) return null;

  const responseBreached = tickets.filter(t => t.response_breached).length;
  const resolutionBreached = tickets.filter(t => t.resolution_breached).length;
  const resolved = tickets.filter(t => t.resolved_at);

  // Average response time (for tickets that have been responded to)
  const respondedTickets = tickets.filter(t => t.first_responded_at);
  const avgResponseMinutes = respondedTickets.length > 0
    ? respondedTickets.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const responded = new Date(t.first_responded_at!).getTime();
        return sum + (responded - created) / 60000;
      }, 0) / respondedTickets.length
    : null;

  // Average resolution time
  const avgResolutionMinutes = resolved.length > 0
    ? resolved.reduce((sum, t) => {
        const created = new Date(t.created_at).getTime();
        const resolvedAt = new Date(t.resolved_at!).getTime();
        return sum + (resolvedAt - created) / 60000;
      }, 0) / resolved.length
    : null;

  return {
    total,
    responseBreachRate: (responseBreached / total) * 100,
    resolutionBreachRate: (resolutionBreached / total) * 100,
    avgResponseMinutes,
    avgResolutionMinutes,
    // For display: format minutes to "Xh Ym"
  };
}
```

### Admin: Access Log Query with Date Range and Gate Filter
```typescript
export function useAccessLogs(filters: {
  dateFrom?: string;
  dateTo?: string;
  accessPointId?: string;
  personType?: string;
  direction?: string;
  page: number;
  pageSize: number;
}) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.accessLogs.today(communityId!).queryKey, filters],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('access_logs')
        .select(
          `id, logged_at, person_name, person_type, direction, method, decision,
           denial_reason, plate_number, guard_notes,
           access_points!inner(name, access_point_type)`,
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .order('logged_at', { ascending: false });

      if (filters.dateFrom) query = query.gte('logged_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('logged_at', filters.dateTo + 'T23:59:59');
      if (filters.accessPointId) query = query.eq('access_point_id', filters.accessPointId);
      if (filters.personType) query = query.eq('person_type', filters.personType);
      if (filters.direction) query = query.eq('direction', filters.direction);

      const from = filters.page * filters.pageSize;
      query = query.range(from, from + filters.pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data ?? [], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}
```

### Mobile: Create Ticket with Photos
```typescript
export function useCreateTicket() {
  const { communityId, residentId } = useAuth();
  const { unitId } = useResidentUnit();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      category_id: string;
      priority?: string;
      location?: string;
      photo_paths?: string[];  // Already uploaded to Storage
    }) => {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .insert({
          community_id: communityId!,
          reported_by: residentId!,  // CRITICAL: Use residentId, not auth.uid()
          unit_id: unitId ?? undefined,
          title: input.title,
          description: input.description,
          category_id: input.category_id,
          priority: input.priority ?? 'medium',
          location: input.location,
        })
        .select()
        .single();
      if (error) throw error;

      // Add initial comment with photos if any
      if (input.photo_paths && input.photo_paths.length > 0) {
        const user = (await supabase.auth.getUser()).data.user!;
        await supabase.from('ticket_comments').insert({
          ticket_id: ticket.id,
          author_id: user.id,
          author_role: 'reporter',
          content: 'Fotos adjuntas al reporte',
          photo_urls: input.photo_paths,
          is_internal: false,
          is_system: false,
        });
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tickets._def });
    },
  });
}
```

### Mobile: Mark Announcement as Read
```typescript
export function useMarkAnnouncementRead() {
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const { error } = await supabase
        .from('announcement_recipients')
        .update({ read_at: new Date().toISOString() })
        .eq('announcement_id', announcementId)
        .eq('resident_id', residentId!)
        .is('read_at', null); // Only update if not already read
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.announcements._def });
    },
  });
}
```

### Query Key Factory Additions
```typescript
// Add to packages/shared/src/queries/keys.ts

export const tickets = createQueryKeys('tickets', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  comments: (ticketId: string) => [{ ticketId }],
  slaMetrics: (communityId: string, period?: string) => [{ communityId, period }],
});

export const announcements = createQueryKeys('announcements', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  recipients: (announcementId: string) => [{ announcementId }],
  feed: (residentId: string) => [{ residentId }],
});

export const documents = createQueryKeys('documents', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  versions: (documentId: string) => [{ documentId }],
});

// Then add to mergeQueryKeys:
export const queryKeys = mergeQueryKeys(
  residents, visitors, payments, accessLogs, amenities,
  notifications, kpis, communities, units, guards,
  packages, occupancies, shifts,
  tickets, announcements, documents,  // NEW
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global state for server data (Redux) | TanStack Query for server state | TQ v5 (2024) | Already using - hooks wrap Supabase calls |
| Client-side filtering of full dataset | Server-side pagination via PostgREST `.range()` | Always best practice | Critical for access_logs (unbounded growth) |
| Custom date pickers | HTML `<input type="date">` | N/A | Admin uses native date inputs consistently |
| Complex DnD libraries for kanban | CSS Grid + click-to-move | N/A | Simpler, more accessible, less code |
| Manual CSV string building | SheetJS `sheet_to_csv()` | Already installed | One API for both XLSX and CSV |

**Deprecated/outdated:**
- `expo-barcode-scanner` is deprecated; use `expo-camera` CameraView (already addressed in Phase 10)
- Supabase JS v1 patterns; project uses v2 with `createBrowserClient` / `createServerClient` from `@supabase/ssr`

---

## Open Questions

1. **RLS Policy Fixes for `reported_by` / `resident_id`**
   - What we know: `reporters_update_own_tickets`, `reporters_create_comments`, and `users_view_own_announcements` use `auth.uid()` where `residents.id` (business ID) is expected. This was flagged in Phase 10/11 research.
   - What's unclear: Whether these policies were fixed in a later migration. The live policies still exist with their original names.
   - Recommendation: Planner should check if these policies were corrected. If not, add a migration task to fix them at the start of Phase 12.

2. **Admin Sidebar Nav Updates**
   - What we know: The sidebar has `/operations` and `/reports` entries but no children defined. Phase 12 adds sub-routes under `/operations`.
   - What's unclear: Whether `/operations` should have a children dropdown like `/finances` does.
   - Recommendation: Add children to the operations nav item: Tickets, Avisos, Accesos, Documentos, Amenidades.

3. **`ticket_comments.photo_urls` Storage Bucket**
   - What we know: Photo URLs in ticket comments can use the `ticket-attachments` bucket which already exists.
   - What's unclear: Whether storage policies for `ticket-attachments` allow resident uploads.
   - Recommendation: Verify storage policies for the bucket during implementation. The `pickAndUploadImage` function handles the upload mechanics.

4. **Amenity Utilization Reports Data Source**
   - What we know: `kpi_daily` has `reservations_made`, `reservations_cancelled`, `no_shows` columns. The `reservations` table has `reserved_range` (tstzrange) for time analysis.
   - What's unclear: Whether `compute_daily_kpis()` correctly populates amenity metrics (the function references column names that may differ from actual schema).
   - Recommendation: Query `reservations` table directly for utilization reports (booking rates by amenity, peak hours from `reserved_range`), rather than relying solely on KPI tables.

---

## Sources

### Primary (HIGH confidence)
- Live database inspection via Supabase MCP: all 19 tables verified with columns, RLS policies, triggers, and functions
- Codebase analysis: admin dashboard patterns from 50+ existing files in `packages/admin/src/`
- Codebase analysis: mobile app patterns from 30+ existing files in `packages/mobile/`
- Migration files: 10 SQL migrations read in full covering all 5 operational domains
- `package.json` for all 3 workspace packages: exact versions confirmed

### Secondary (MEDIUM confidence)
- Phase 11 research document: established patterns for DataTable, Recharts, SheetJS, Sonner
- Phase 10 research document: mobile patterns, RLS policy issues, Supabase query patterns
- MEMORY.md: `residents.id` vs `auth.uid()` gotcha, storage buckets, edge functions

### Tertiary (LOW confidence)
- Kanban implementation approach: based on general CSS Grid knowledge, not verified with a specific library

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified in package.json
- Architecture: HIGH - follows established patterns from Phase 11 (admin) and Phase 10 (mobile) with verified code examples
- Database schema: HIGH - all 19 tables verified in live database with columns, RLS policies, triggers, functions
- Pitfalls: HIGH - identified from actual codebase issues (RLS mismatch, immutable tables, explicit function calls)
- Code examples: HIGH - adapted from verified existing patterns in the codebase

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (stable - no version changes expected)
