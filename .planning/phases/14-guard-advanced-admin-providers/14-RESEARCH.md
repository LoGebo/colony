# Phase 14: Guard Advanced + Admin Providers/Parking/Moves - Research

**Researched:** 2026-02-08
**Domain:** Guard patrol/incident/emergency mobile screens + Admin provider/parking/move/marketplace-moderation dashboard pages
**Confidence:** HIGH (verified via full database schema inspection, existing code analysis, established codebase patterns)

## Summary

Phase 14 covers two distinct but parallel workstreams: (1) guard mobile features -- patrol route display with NFC checkpoint scanning, incident reporting with media/timeline, shift handover notes, and a persistent emergency panic button; and (2) admin dashboard features -- provider company management with documentation/personnel/access schedules/work orders, parking inventory management, move-in/move-out workflow, and marketplace moderation.

All five plan areas have **complete or near-complete database schemas** already deployed from v1.0 (Phases 3, 5, 7, 8). The backend tables, enums, RLS policies, triggers, and helper functions are ready. The one significant gap is: **there is no `work_orders` table** -- the `providers.total_work_orders` column references it, and table comments mention it will be "created separately," but it was never created. This requires a migration.

Key findings:
1. **Patrol infrastructure is fully modeled**: `patrol_checkpoints` (NFC serial, GPS coordinates, tolerance), `patrol_routes` (ordered checkpoint sequences), `patrol_logs` (session tracking), and `patrol_checkpoint_logs` (individual scans with GPS validation). Auto-progress triggers already update completion counts and auto-complete patrols.
2. **Incident system has rich timeline support**: `incidents` table with JSONB timeline, `incident_media` for evidence, `incident_types` for categories, and `incident_assignments`. Helper functions: `add_incident_event()`, `add_incident_comment()`, `escalate_incident()`. Auto-triggers log status changes, media uploads, and assignments to the timeline.
3. **Emergency alerts use a state machine**: `emergency_alerts` with `emergency_status` enum (triggered -> acknowledged -> responding -> on_scene -> resolved/false_alarm/escalated) and `emergency_responders` junction table. Auto-priority based on emergency type, SLA metric functions.
4. **No shift handover table exists**. Guard shift handover notes need either a new `shift_handovers` table or can be implemented as a lightweight JSONB log on `patrol_logs` or a new simple table.
5. **NFC reading requires `react-native-nfc-manager`** with Expo config plugin. This is a native dependency requiring EAS Build (not Expo Go). expo-location is also needed for GPS coordinates during patrol scans.
6. **Work orders table is MISSING** -- needs a migration before the admin can create/track work orders.
7. **Moderation queue is fully built** with PostgreSQL `FOR UPDATE SKIP LOCKED` pattern. Functions `claim_moderation_item()`, `resolve_moderation()`, `release_stale_claims()` are production-ready.

**Primary recommendation:** Add two new guard tabs (Patrol, Emergency/Incidents), implement NFC scanning via `react-native-nfc-manager` with GPS validation via `expo-location`, create a lightweight `shift_handovers` table migration and a `provider_work_orders` table migration, then build admin dashboard pages under new sidebar sections (Providers, Parking, Moves, Marketplace). Reuse established patterns: TanStack Query hooks, `'as never'` enum casting, Supabase RPC calls for complex operations, SECURITY DEFINER functions for cross-table operations.

---

## Standard Stack

### Core (Already Installed)

| Library | Version | Purpose | Install Location |
|---------|---------|---------|------------------|
| `expo` | ~54.0.33 | Managed workflow framework | `@upoe/mobile` |
| `expo-router` | ~6.0.23 | File-based routing | `@upoe/mobile` |
| `@supabase/supabase-js` | ^2.95.3 | Supabase client | `@upoe/mobile` |
| `@tanstack/react-query` | ^5.90.20 | Server state management | both |
| `nativewind` | ^4.2.1 | Tailwind for React Native | `@upoe/mobile` |
| `tailwindcss` | 3.4.17 | Styling engine (mobile, NOT v4) | `@upoe/mobile` |
| `expo-image-picker` | ~17.0.10 | Photo/video capture for incidents | `@upoe/mobile` |
| `expo-camera` | ~17.0.10 | Camera access (already installed) | `@upoe/mobile` |
| `date-fns` | ^4.1.0 | Date formatting with `{ locale: es }` | both |
| `@lukemorales/query-key-factory` | ^1.3.4 | Type-safe query keys | `@upoe/shared` |
| `next` | 16.1.6 | Admin dashboard framework | `@upoe/admin` |
| `@tanstack/react-table` | ^8.21.3 | Admin data tables | `@upoe/admin` |
| `recharts` | ^3.7.0 | Admin charts | `@upoe/admin` |
| `sonner` | ^2.0.7 | Admin toast notifications | `@upoe/admin` |
| `xlsx` | ^0.18.5 | Excel export | `@upoe/admin` |
| `tailwindcss` | ^4 | Admin styling (v4, different from mobile) | `@upoe/admin` |

### New Dependencies

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `react-native-nfc-manager` | ^3.17.x | NFC tag reading for patrol checkpoints | Only React Native NFC library with Expo config plugin support. Required for GPATR-02. Reads NFC serial numbers from checkpoint tags. |
| `expo-location` | ~18.x | GPS coordinates during patrol scans | Needed for GPS validation against checkpoint tolerance. Provides `getCurrentPositionAsync()` for lat/lng at scan time. |
| `expo-haptics` | ~14.x | Haptic feedback for panic button | Provides haptic vibration patterns for emergency button confirmation. Short impact for press, heavy for activation. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-native-nfc-manager` | Manual NFC via native modules | Much more work, no Expo plugin support, reinventing the wheel |
| `expo-location` for GPS | `react-native-geolocation-service` | expo-location has built-in Expo plugin, no extra config needed |
| New `shift_handovers` table | JSONB field on patrol_logs | Handovers are independent of patrols -- a guard may leave notes without completing a patrol. Separate table is cleaner. |
| New `provider_work_orders` table | Reuse `maintenance_tickets` | Work orders are provider-specific with cost tracking, rating, and completion workflow. Different enough to warrant own table. |

### Installation

```bash
# Mobile - new native deps (require EAS Build, not Expo Go)
cd packages/mobile && pnpm add react-native-nfc-manager expo-location expo-haptics

# No new admin dependencies needed
```

**app.json plugin config required:**
```json
{
  "plugins": [
    "react-native-nfc-manager",
    [
      "expo-location",
      {
        "locationWhenInUsePermission": "Necesitamos tu ubicacion para validar los puntos de control de ronda"
      }
    ]
  ]
}
```

---

## Architecture Patterns

### Guard Mobile -- Recommended Project Structure

```
packages/mobile/
  app/(guard)/
    _layout.tsx                        # MODIFY: Add patrol and incidents tabs
    index.tsx                          # Existing: Gate/Caseta screen
    directory/                         # Existing: Resident/vehicle search
    packages/                          # Existing: Package management
    gate/                              # Existing: QR scan, manual check-in (hidden tab)
    patrol/                            # NEW: Patrol features
      _layout.tsx                      # Stack layout
      index.tsx                        # GPATR-01: Active patrol routes list
      [id].tsx                         # GPATR-01+03: Route detail with checkpoint progress
      scan.tsx                         # GPATR-02: NFC scan screen with GPS capture
    incidents/                         # NEW: Incident features
      _layout.tsx                      # Stack layout
      index.tsx                        # GINC-01+02: Incident list + create button
      create.tsx                       # GINC-01: Create incident report form
      [id].tsx                         # GINC-02: Incident detail with timeline
      handover.tsx                     # GINC-03: Shift handover notes
  src/
    hooks/
      useGateOps.ts                    # Existing: Gate operations hooks
      usePatrol.ts                     # NEW: Patrol hooks (start, scan checkpoint, abandon)
      useIncidents.ts                  # NEW: Incident hooks (create, update, comment, media)
      useEmergency.ts                  # NEW: Emergency alert hooks (trigger, type selection)
    components/
      guard/
        PatrolProgress.tsx             # NEW: Progress indicator (X/Y checkpoints)
        CheckpointCard.tsx             # NEW: Individual checkpoint status
        IncidentTimelineItem.tsx       # NEW: Timeline event renderer
        HandoverNoteCard.tsx           # NEW: Handover note display
        PanicButton.tsx                # NEW: Persistent emergency button (absolute positioned)
        EmergencyTypeSheet.tsx         # NEW: Emergency type selection bottom sheet
```

### Admin Dashboard -- Recommended Project Structure

```
packages/admin/
  src/app/(dashboard)/
    layout.tsx                         # MODIFY: Add sidebar sections for Providers, Parking, Moves
    providers/                         # NEW: Provider management
      page.tsx                         # APROV-01: Provider list with status filters
      [id]/
        page.tsx                       # APROV-01+02+03+04: Provider detail (tabs: info, docs, personnel, schedules)
      work-orders/
        page.tsx                       # APROV-05: Work order list
        [id]/
          page.tsx                     # APROV-05: Work order detail
    parking/                           # NEW: Parking management
      page.tsx                         # APARK-01: Parking inventory grid/table
      violations/
        page.tsx                       # APARK-04: Violation list
    moves/                             # NEW: Move management
      page.tsx                         # AMOVE-01: Move requests list
      [id]/
        page.tsx                       # AMOVE-02+03+04: Move detail with validation checklist
    marketplace/                       # NEW: Marketplace moderation
      page.tsx                         # AMRKT-01+02: Moderation queue
      categories/
        page.tsx                       # AMRKT-03: Category management
```

### Pattern 1: Guard Tab Layout Extension

**What:** Adding new tabs to the existing guard `_layout.tsx` for Patrol and Incidents.
**When to use:** Adding new guard feature areas.

```typescript
// packages/mobile/app/(guard)/_layout.tsx
// Add two new tabs and keep gate hidden
<Tabs.Screen
  name="patrol"
  options={{
    tabBarLabel: 'Ronda',
    tabBarIcon: ({ color }) => (
      <Text style={{ color, fontSize: 20 }}>{'route-icon'}</Text>
    ),
  }}
/>
<Tabs.Screen
  name="incidents"
  options={{
    tabBarLabel: 'Incidentes',
    tabBarIcon: ({ color }) => (
      <Text style={{ color, fontSize: 20 }}>{'alert-icon'}</Text>
    ),
  }}
/>
```

### Pattern 2: NFC Scanning with GPS Validation

**What:** Read NFC tag serial, capture GPS coordinates, submit checkpoint scan.
**When to use:** Guard patrol checkpoint scanning.

```typescript
// Scanning NFC checkpoint during patrol
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import * as Location from 'expo-location';

async function scanCheckpoint(patrolLogId: string) {
  // 1. Request NFC tech
  await NfcManager.requestTechnology(NfcTech.Ndef);
  const tag = await NfcManager.getTag();
  const nfcSerial = tag?.id; // Factory serial, e.g., "04:A2:E5:1A:BC:34:80"

  // 2. Get GPS coordinates
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const { latitude, longitude, accuracy } = location.coords;

  // 3. Insert checkpoint log (triggers auto-validate GPS + update patrol progress)
  const { data, error } = await supabase
    .from('patrol_checkpoint_logs')
    .insert({
      patrol_log_id: patrolLogId,
      checkpoint_id: matchedCheckpointId, // looked up by NFC serial
      nfc_serial_scanned: nfcSerial,
      gps_lat: latitude,
      gps_lng: longitude,
      gps_accuracy_meters: accuracy,
      sequence_order: currentSequenceIndex,
    } as never)
    .select()
    .single();

  // 4. Cleanup
  NfcManager.cancelTechnologyRequest();
}
```

### Pattern 3: Persistent Panic Button (Absolute Positioned)

**What:** A floating panic button visible on all guard screens.
**When to use:** GEMRG-01 requires the button to be accessible from any screen.

```typescript
// Render panic button in guard _layout.tsx, OUTSIDE the Tabs component
// Uses absolute positioning so it floats above all tab content

export default function GuardLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs screenOptions={{ headerShown: false }}>
        {/* ... tab screens ... */}
      </Tabs>
      {/* Persistent panic button - always visible */}
      <PanicButton />
    </View>
  );
}

// PanicButton component: absolute positioned, bottom-right
// Long-press to activate (prevents accidental triggers)
// Shows emergency type selection sheet after activation
```

### Pattern 4: Admin Sidebar Extension

**What:** Adding new navigation sections to the admin dashboard sidebar.
**When to use:** Adding new admin feature areas.

```typescript
// Add to navItems array in packages/admin/src/app/(dashboard)/layout.tsx
const navItems: NavItem[] = [
  // ... existing items ...
  {
    href: '/providers',
    label: 'Proveedores',
    icon: 'truck',
    children: [
      { href: '/providers/work-orders', label: 'Ordenes de Trabajo' },
    ],
  },
  {
    href: '/parking',
    label: 'Estacionamiento',
    icon: 'car',
    children: [
      { href: '/parking/violations', label: 'Infracciones' },
    ],
  },
  {
    href: '/moves',
    label: 'Mudanzas',
    icon: 'box',
  },
  {
    href: '/marketplace',
    label: 'Marketplace',
    icon: 'store',
    children: [
      { href: '/marketplace/categories', label: 'Categorias' },
    ],
  },
];
```

### Pattern 5: Incident Timeline Rendering

**What:** Rendering the JSONB timeline array from the incidents table.
**When to use:** Incident detail screen (GINC-02).

```typescript
// Timeline events are stored as JSONB array in incidents.timeline
// Each event: { id, type, timestamp, actor_id, actor_name, data }
// Types: 'created', 'status_changed', 'assigned', 'comment', 'media_added', 'escalated'

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  actor_id: string | null;
  actor_name: string;
  data: Record<string, unknown>;
}

// Parse and render in reverse chronological order
const timeline = (incident.timeline as TimelineEvent[]).sort(
  (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
);
```

### Anti-Patterns to Avoid

- **Hand-rolling NFC serial matching on the client:** The database trigger `validate_checkpoint_gps()` handles GPS validation server-side. The client should look up the checkpoint by NFC serial via a query, but validation happens in the DB.
- **Creating separate emergency alert screens:** The panic button must be persistent and accessible from ANY guard screen. Do not create a separate tab -- use absolute positioning in the guard layout.
- **Storing handover notes in patrol logs:** Handover notes are independent of patrol completion. A guard may leave handover notes even without completing a patrol. Use a separate table.
- **Building a custom moderation queue on the admin:** The database already has `claim_moderation_item()` and `resolve_moderation()` RPCs. Use those, do not rebuild the claiming logic in the frontend.
- **Ignoring the `'as never'` cast pattern:** The database types are not regenerated. All Supabase `.insert()` and `.update()` calls with enum values must use `as never` to satisfy TypeScript.

---

## Database Schema Reference

### Tables This Phase Reads/Writes

**Guard Patrol (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `patrol_routes` | SELECT | List active routes for guard's community |
| `patrol_checkpoints` | SELECT | Get checkpoint details (NFC serial, GPS coords, name) |
| `patrol_logs` | INSERT, SELECT, UPDATE | Create patrol session, track progress, abandon |
| `patrol_checkpoint_logs` | INSERT, SELECT | Log individual NFC scans with GPS |
| `guard_shifts` | SELECT | Show current shift info for handover |

**Guard Incidents (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `incidents` | INSERT, SELECT, UPDATE | Create/view/update incident reports |
| `incident_types` | SELECT | List available incident categories |
| `incident_media` | INSERT, SELECT | Upload evidence photos/videos |
| `incident_assignments` | SELECT | View who is assigned |

**Guard Emergency (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `emergency_alerts` | INSERT, SELECT, UPDATE | Trigger/view/update emergency alerts |
| `emergency_responders` | INSERT, SELECT, UPDATE | Track guard response to emergencies |

**Guard Handover (NEW -- needs migration):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `shift_handovers` | INSERT, SELECT | Create/view handover notes between shifts |

**Admin Providers (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `providers` | CRUD | Manage provider companies |
| `provider_documents` | CRUD | Track insurance, licenses, certifications |
| `provider_personnel` | CRUD | Manage authorized employees |
| `provider_access_schedules` | CRUD | Configure access time windows |
| `provider_documents_expiring` | SELECT (view) | Dashboard for expiring documents |

**Admin Work Orders (NEW -- needs migration):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `provider_work_orders` | CRUD | Create/track work orders for providers |

**Admin Parking (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `parking_spots` | CRUD | Manage parking inventory |
| `parking_assignments` | CRUD | Assign spots to units |
| `parking_reservations` | SELECT | View visitor parking reservations |
| `parking_violations` | SELECT, UPDATE | View and manage violations |

**Admin Moves (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `move_requests` | CRUD | Create/manage move requests |
| `move_validations` | SELECT, UPDATE | Track validation checklist items |
| `move_deposits` | CRUD | Manage damage deposits |

**Admin Marketplace (existing):**
| Table | Operation | Purpose |
|-------|-----------|---------|
| `moderation_queue` | SELECT, via RPCs | View pending moderation items |
| `marketplace_listings` | SELECT, UPDATE | View/moderate listings |
| `listing_categories` | N/A (enum, not table) | Category is an enum: sale, service, rental, wanted |

### Existing Database Functions (Use via RPC)

| Function | Purpose | Used By |
|----------|---------|---------|
| `is_provider_access_allowed(provider_id, check_time)` | Check if provider is within authorized schedule | Guard provider verification (GEMRG-04) |
| `add_incident_event(incident_id, event_type, actor_id, data)` | Append event to incident timeline | Follow-up comments (GINC-02) |
| `add_incident_comment(incident_id, text, is_internal, actor_id)` | Convenience wrapper for comment events | Guard/admin comments |
| `escalate_incident(incident_id, new_priority, reason)` | Change priority + log event | Admin escalation |
| `get_emergency_sla_metrics(emergency_id)` | Calculate SLA intervals | Admin reporting |
| `get_available_parking_spots(community_id, spot_type?)` | List unassigned parking spots | Parking assignment UI |
| `get_unit_parking_spots(unit_id)` | Spots assigned to a unit | Unit profile |
| `create_parking_reservation(...)` | Create visitor parking reservation with validation | Resident/admin |
| `cancel_parking_reservation(reservation_id)` | Cancel a reservation | Resident/admin |
| `checkin_parking_visitor(reservation_id)` | Record visitor check-in | Guard |
| `checkout_parking_visitor(reservation_id)` | Record visitor check-out + complete | Guard |
| `get_todays_parking_reservations(community_id)` | Today's reservations for dashboard | Guard/admin |
| `report_parking_violation(...)` | Create violation, auto-link vehicle | Guard |
| `check_debt_free(unit_id)` | Check if unit has zero balance | Move validation |
| `process_deposit_refund(deposit_id, deduction, reason)` | Process deposit deductions | Admin |
| `approve_deposit_refund(deposit_id)` | Approve deposit for refund | Admin |
| `complete_deposit_refund(deposit_id, method, reference)` | Complete refund | Admin |
| `forfeit_deposit(deposit_id, reason)` | Forfeit entire deposit | Admin |
| `claim_moderation_item(community_id)` | Claim next moderation queue item | Admin moderator |
| `resolve_moderation(queue_id, resolution, notes)` | Approve/reject moderation item | Admin moderator |
| `release_stale_claims(timeout_minutes?)` | Release stale moderation claims | Cron/admin |

### Enums Reference

| Enum | Values | Used For |
|------|--------|----------|
| `incident_severity` | low, medium, high, critical | Incident reports |
| `incident_status` | reported, acknowledged, investigating, in_progress, pending_review, resolved, closed | Incident workflow |
| `emergency_type` | panic, medical, fire, intrusion, natural_disaster | Emergency classification |
| `emergency_status` | triggered, acknowledged, responding, on_scene, resolved, false_alarm, escalated | Emergency workflow |
| `provider_status` | pending_approval, active, suspended, inactive | Provider lifecycle |
| `document_status` | pending_verification, verified, expired, rejected | Provider document verification |
| `parking_spot_type` | assigned, visitor, commercial, disabled, loading, reserved | Spot classification |
| `parking_spot_status` | available, occupied, reserved, maintenance, blocked | Spot operational status |
| `parking_violation_type` | unauthorized_parking, double_parking, blocking, overstay, wrong_spot, other | Violation classification |
| `parking_violation_status` | reported, warned, fined, resolved, dismissed | Violation resolution |
| `parking_assignment_type` | ownership, rental, temporary | Assignment type |
| `parking_reservation_status` | pending, confirmed, cancelled, completed, no_show | Reservation workflow |
| `move_type` | move_in, move_out | Move direction |
| `move_status` | requested, validating, validation_failed, approved, scheduled, in_progress, completed, cancelled | Move workflow |
| `validation_status` | pending, passed, failed, waived | Validation item status |
| `deposit_status` | collected, held, inspection_pending, deductions_pending, refund_pending, refunded, forfeited | Deposit lifecycle |
| `moderation_status` | pending, in_review, approved, rejected, flagged | Content moderation |
| `listing_category` | sale, service, rental, wanted | Marketplace category (enum, not table) |

---

## Migrations Needed

### Migration 1: `shift_handovers` table

The database has no table for guard shift handover notes. This is required for GINC-03.

```sql
CREATE TABLE shift_handovers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  guard_id UUID NOT NULL REFERENCES guards(id) ON DELETE CASCADE,
  access_point_id UUID REFERENCES access_points(id) ON DELETE SET NULL,
  shift_id UUID REFERENCES guard_shifts(id) ON DELETE SET NULL,

  -- Handover content
  notes TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),

  -- Pending items for next guard
  pending_items JSONB DEFAULT '[]'::JSONB,
  -- Format: [{ "description": "...", "completed": false }]

  -- Shift timing
  shift_started_at TIMESTAMPTZ,
  shift_ended_at TIMESTAMPTZ,

  -- Acknowledgment by incoming guard
  acknowledged_by UUID REFERENCES guards(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_shift_handovers_community ON shift_handovers(community_id, created_at DESC);
CREATE INDEX idx_shift_handovers_guard ON shift_handovers(guard_id, created_at DESC);
CREATE INDEX idx_shift_handovers_unacknowledged ON shift_handovers(community_id)
  WHERE acknowledged_at IS NULL;

-- RLS
ALTER TABLE shift_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_community_handovers" ON shift_handovers
  FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()));

CREATE POLICY "guards_insert_handovers" ON shift_handovers
  FOR INSERT TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND guard_id IN (SELECT id FROM guards WHERE user_id = auth.uid())
  );

CREATE POLICY "guards_update_handovers" ON shift_handovers
  FOR UPDATE TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (
      guard_id IN (SELECT id FROM guards WHERE user_id = auth.uid())
      OR (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- Audit trigger
CREATE TRIGGER set_shift_handovers_audit
  BEFORE INSERT OR UPDATE ON shift_handovers
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();
```

### Migration 2: `provider_work_orders` table

The `providers` table references `total_work_orders` and comments mention "created separately" but the table was never created. Required for APROV-05.

```sql
CREATE TABLE provider_work_orders (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,

  -- Reference number (auto-generated)
  work_order_number TEXT NOT NULL,

  -- Details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT, -- plumbing, electrical, etc.

  -- Location
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  location_description TEXT,

  -- Scheduling
  requested_date DATE,
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  completed_date DATE,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'
  )),

  -- Cost tracking
  estimated_cost NUMERIC(15, 4),
  actual_cost NUMERIC(15, 4),
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- Link to maintenance ticket (if work order was created from a ticket)
  ticket_id UUID REFERENCES maintenance_tickets(id) ON DELETE SET NULL,

  -- Rating (after completion)
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  rating_notes TEXT,

  -- Assigned personnel
  assigned_personnel_ids UUID[], -- Array of provider_personnel IDs

  -- Notes
  admin_notes TEXT,
  provider_notes TEXT,

  -- Completion
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completion_notes TEXT,

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMPTZ,

  -- Unique work order number per community
  CONSTRAINT uq_work_order_number UNIQUE (community_id, work_order_number)
);

-- Auto-generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number(p_community_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_year TEXT;
  v_seq INTEGER;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(work_order_number, '^WO-' || v_year || '-', ''), work_order_number)::INTEGER), 0) + 1
  INTO v_seq
  FROM public.provider_work_orders
  WHERE community_id = p_community_id AND work_order_number LIKE 'WO-' || v_year || '-%';
  RETURN 'WO-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');
END; $$;

CREATE OR REPLACE FUNCTION set_work_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.work_order_number IS NULL OR NEW.work_order_number = '' THEN
    NEW.work_order_number := public.generate_work_order_number(NEW.community_id);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_set_work_order_number
  BEFORE INSERT ON provider_work_orders
  FOR EACH ROW EXECUTE FUNCTION set_work_order_number();

-- Update provider stats on completion
CREATE OR REPLACE FUNCTION update_provider_work_order_stats()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.providers SET
      total_work_orders = total_work_orders + 1,
      average_rating = (
        SELECT AVG(rating) FROM public.provider_work_orders
        WHERE provider_id = NEW.provider_id AND rating IS NOT NULL AND deleted_at IS NULL
      )
    WHERE id = NEW.provider_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_update_provider_stats
  AFTER UPDATE ON provider_work_orders
  FOR EACH ROW EXECUTE FUNCTION update_provider_work_order_stats();

-- Indexes
CREATE INDEX idx_work_orders_community_status ON provider_work_orders(community_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_provider ON provider_work_orders(provider_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_work_orders_scheduled ON provider_work_orders(scheduled_date) WHERE status IN ('approved', 'scheduled') AND deleted_at IS NULL;

-- RLS
ALTER TABLE provider_work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_work_orders" ON provider_work_orders
  FOR ALL TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) IN ('admin', 'manager'))
  WITH CHECK (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) IN ('admin', 'manager'));

CREATE POLICY "guard_view_work_orders" ON provider_work_orders
  FOR SELECT TO authenticated
  USING (community_id = (SELECT get_current_community_id()) AND (SELECT get_current_user_role()) = 'guard' AND deleted_at IS NULL);

-- Audit
CREATE TRIGGER set_work_orders_audit BEFORE INSERT OR UPDATE ON provider_work_orders FOR EACH ROW EXECUTE FUNCTION set_audit_fields();
CREATE TRIGGER work_orders_soft_delete BEFORE DELETE ON provider_work_orders FOR EACH ROW EXECUTE FUNCTION soft_delete();
```

---

## Query Key Factories Needed

Add to `packages/shared/src/queries/keys.ts`:

```typescript
export const patrols = createQueryKeys('patrols', {
  all: null,
  routes: (communityId: string) => [{ communityId }],
  routeDetail: (id: string) => [id],
  activeLogs: (guardId: string) => [{ guardId }],
  logDetail: (id: string) => [id],
  checkpoints: (communityId: string) => [{ communityId }],
});

export const incidents = createQueryKeys('incidents', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  types: (communityId: string) => [{ communityId }],
  media: (incidentId: string) => [{ incidentId }],
});

export const emergencies = createQueryKeys('emergencies', {
  all: null,
  active: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  responders: (emergencyId: string) => [{ emergencyId }],
});

export const handovers = createQueryKeys('handovers', {
  all: null,
  recent: (communityId: string) => [{ communityId }],
  unacknowledged: (communityId: string) => [{ communityId }],
});

export const providers = createQueryKeys('providers', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  documents: (providerId: string) => [{ providerId }],
  personnel: (providerId: string) => [{ providerId }],
  schedules: (providerId: string) => [{ providerId }],
  expiringDocs: (communityId: string) => [{ communityId }],
});

export const workOrders = createQueryKeys('work-orders', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  byProvider: (providerId: string) => [{ providerId }],
});

export const parking = createQueryKeys('parking', {
  all: null,
  spots: (communityId: string) => [{ communityId }],
  spotDetail: (id: string) => [id],
  assignments: (communityId: string) => [{ communityId }],
  reservations: (communityId: string) => [{ communityId }],
  violations: (communityId: string) => [{ communityId }],
  todayReservations: (communityId: string) => [{ communityId }],
});

export const moves = createQueryKeys('moves', {
  all: null,
  list: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  validations: (moveId: string) => [{ moveId }],
  deposits: (communityId: string) => [{ communityId }],
  depositDetail: (id: string) => [id],
});

export const moderation = createQueryKeys('moderation', {
  all: null,
  queue: (communityId: string) => [{ communityId }],
  detail: (id: string) => [id],
  stats: (communityId: string) => [{ communityId }],
});
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| NFC tag reading | Custom native module | `react-native-nfc-manager` | Cross-platform NFC with Expo config plugin, handles all NFC tech types |
| GPS distance validation | Client-side haversine | Database trigger `validate_checkpoint_gps()` | Already built, runs server-side on INSERT, calculates `gps_within_tolerance` |
| Patrol progress tracking | Manual checkpoint counting | Database trigger `update_patrol_progress()` | Auto-increments `checkpoints_visited`, auto-completes patrol when all scanned |
| Incident timeline management | Client-side array manipulation | Database functions `add_incident_event()`, `add_incident_comment()` | Auto-resolves actor names, maintains consistent event format |
| Incident number generation | Client-side counter | Database trigger `set_incident_number()` | Auto-generates `INC-YYYY-NNNNN` format, handles concurrency |
| Emergency priority assignment | Manual priority selection | Database trigger `set_emergency_priority()` | Auto-maps emergency_type to priority_level |
| Emergency timeline updates | Manual status tracking | Database trigger `update_emergency_timeline()` | Auto-updates alert timestamps when responder statuses change |
| Moderation claiming | Custom lock/queue logic | RPC `claim_moderation_item()` | PostgreSQL `FOR UPDATE SKIP LOCKED` pattern, production-grade concurrency |
| Moderation resolution | Custom update + cascading | RPC `resolve_moderation()` | Updates queue + source content (listing/post/comment) atomically |
| Provider access checking | Manual schedule comparison | RPC `is_provider_access_allowed()` | Handles day-of-week, time ranges, effective dates |
| Parking availability check | Manual overlap detection | RPC `is_parking_available()` + exclusion constraint | DB-enforced double-booking prevention with timezone handling |
| Move validation summary | Manual all-passed check | Database trigger `update_validation_summary()` | Auto-updates `all_validations_passed` when any validation changes |
| Debt-free validation | Manual balance query | Database trigger `auto_check_debt_free()` + `check_debt_free()` | Auto-checks unit balance from `unit_balances` view |
| Deposit refund workflow | Manual status transitions | RPCs `process_deposit_refund()`, `approve_deposit_refund()`, `complete_deposit_refund()`, `forfeit_deposit()` | Validates status transitions, prevents invalid state changes |
| Work order number generation | Client-side counter | Database trigger (from migration) | Auto-generates `WO-YYYY-NNNNN`, handles concurrency |

**Key insight:** The v1.0 database phase built extensive server-side logic (triggers, functions, RPCs) for all these domains. The frontend should call RPCs and rely on triggers rather than reimplementing business logic. The client's job is to present forms, call RPCs/inserts, and display results.

---

## Common Pitfalls

### Pitfall 1: NFC Not Working in Expo Go

**What goes wrong:** `react-native-nfc-manager` is a native module that cannot run in Expo Go. Attempting to import it in Expo Go causes a crash.
**Why it happens:** NFC requires native iOS/Android APIs not bundled in Expo Go.
**How to avoid:** Use EAS Build (`eas build --profile development`) to create a development build. Add `react-native-nfc-manager` to `app.json` plugins. Test on physical device only (NFC not available in simulators).
**Warning signs:** "Native module not found" errors, app crashes on import.

### Pitfall 2: NFC Serial Format Mismatch

**What goes wrong:** The scanned NFC serial format may not match what's stored in `patrol_checkpoints.nfc_serial`. Different NFC readers return serials in different formats (colon-separated, hex string, reversed bytes).
**Why it happens:** NFC tag IDs can be represented as `"04:A2:E5:1A:BC:34:80"` or `"04A2E51ABC3480"` depending on the reader/library.
**How to avoid:** Normalize the NFC serial on the client before looking up the checkpoint. Strip colons, uppercase, compare. Consider storing both formats or normalizing in the DB lookup query.
**Warning signs:** NFC scans succeed but checkpoint lookup fails.

### Pitfall 3: GPS Permission Not Granted for Patrol

**What goes wrong:** GPS coordinates are `null` when logging checkpoint scans, causing `gps_within_tolerance` to be `NULL` instead of `true/false`.
**Why it happens:** Location permissions not requested before starting patrol, or user denied.
**How to avoid:** Request location permissions at patrol start, before any scanning. If denied, warn the guard but allow patrol to continue (GPS is optional per schema -- `gps_within_tolerance` can be NULL). Show a yellow warning badge on scans without GPS.
**Warning signs:** All checkpoint scans have `gps_within_tolerance = NULL`.

### Pitfall 4: Emergency Panic Button Accidental Triggers

**What goes wrong:** Guards accidentally trigger emergency alerts, creating noise and alarm.
**Why it happens:** A prominent, easily accessible button can be pressed unintentionally.
**How to avoid:** Require a long-press (2+ seconds) with visual countdown to activate. Show a confirmation with emergency type selection before actually creating the `emergency_alerts` record. Use `expo-haptics` for tactile feedback during the long-press.
**Warning signs:** Multiple false alarm records, guards complaining about accidental triggers.

### Pitfall 5: `'as never'` Enum Cast Missing

**What goes wrong:** TypeScript errors when inserting records with enum columns (e.g., `incident_severity`, `parking_spot_type`, `move_status`).
**Why it happens:** Database types (`supabase/database.types.ts`) are not regenerated. Enum string values don't match the stale types.
**How to avoid:** Always cast the entire insert/update object with `as never`. This is the established project convention per MEMORY.md.
**Warning signs:** TypeScript compilation errors on `.insert()` or `.update()` calls.

### Pitfall 6: Work Orders Table Does Not Exist

**What goes wrong:** Attempting to query `provider_work_orders` fails with "relation does not exist."
**Why it happens:** The table was referenced in `providers` comments but never created during v1.0.
**How to avoid:** Create the migration FIRST before building any work order UI. Include it in plan 14-04 as the first task.
**Warning signs:** PostgREST returns 404 for `/provider_work_orders`.

### Pitfall 7: Marketplace Category is an Enum, Not a Table

**What goes wrong:** Trying to query a `listing_categories` table for AMRKT-03 (manage marketplace categories) fails.
**Why it happens:** Listing categories are defined as a PostgreSQL enum (`listing_category`), not a table. Enums cannot be dynamically managed via the API.
**How to avoid:** For AMRKT-03, "manage categories" means displaying the fixed enum values with admin controls (enable/disable per community via `community_settings`). If dynamic categories are needed, a new `marketplace_categories` table would be required, but the current enum approach with community-level toggles is simpler.
**Warning signs:** No `listing_categories` table in PostgREST schema.

### Pitfall 8: Handover Notes Table Does Not Exist

**What goes wrong:** Attempting to query `shift_handovers` fails.
**Why it happens:** No table for shift handover notes was created during v1.0.
**How to avoid:** Create the migration FIRST before building handover UI. Include it in plan 14-02.
**Warning signs:** PostgREST returns 404 for `/shift_handovers`.

---

## Code Examples

### Starting a Patrol Session

```typescript
// Source: Database schema analysis
export function useStartPatrol() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (routeId: string) => {
      // Get route to know total checkpoints
      const { data: route } = await supabase
        .from('patrol_routes')
        .select('checkpoint_sequence')
        .eq('id', routeId)
        .single();

      if (!route) throw new Error('Ruta no encontrada');

      const { data, error } = await supabase
        .from('patrol_logs')
        .insert({
          community_id: communityId!,
          route_id: routeId,
          guard_id: guardId!,
          checkpoints_total: route.checkpoint_sequence.length,
          status: 'in_progress',
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patrols._def });
    },
  });
}
```

### Creating an Incident Report

```typescript
// Source: Database schema analysis
export function useCreateIncident() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      title: string;
      description: string;
      incident_type_id?: string;
      severity: string;
      location_type?: string;
      location_description?: string;
      gps_latitude?: number;
      gps_longitude?: number;
    }) => {
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          community_id: communityId!,
          reported_by_guard: guardId!,
          title: input.title,
          description: input.description,
          incident_type_id: input.incident_type_id,
          severity: input.severity,
          location_type: input.location_type,
          location_description: input.location_description,
          gps_latitude: input.gps_latitude,
          gps_longitude: input.gps_longitude,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents._def });
    },
  });
}
```

### Triggering Emergency Alert

```typescript
// Source: Database schema analysis
export function useTriggerEmergency() {
  const { communityId, userId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      emergency_type: string;
      location_description?: string;
      location_lat?: number;
      location_lng?: number;
    }) => {
      const { data, error } = await supabase
        .from('emergency_alerts')
        .insert({
          community_id: communityId!,
          emergency_type: input.emergency_type,
          triggered_by: userId!,
          location_description: input.location_description,
          location_lat: input.location_lat,
          location_lng: input.location_lng,
        } as never)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.emergencies._def });
    },
  });
}
```

### Admin Moderation Queue

```typescript
// Source: Database moderation_queue functions
export function useModerationQueue(communityId: string) {
  return useQuery({
    queryKey: queryKeys.moderation.queue(communityId).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('moderation_queue')
        .select(`
          id, item_type, item_id, priority, queued_at,
          assigned_to, assigned_at, resolved_at, resolution
        `)
        .eq('community_id', communityId)
        .is('resolved_at', null)
        .order('priority', { ascending: false })
        .order('queued_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

export function useClaimModerationItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (communityId: string) => {
      const { data, error } = await supabase.rpc('claim_moderation_item', {
        p_community_id: communityId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation._def });
    },
  });
}

export function useResolveModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { queueId: string; resolution: 'approved' | 'rejected'; notes?: string }) => {
      const { data, error } = await supabase.rpc('resolve_moderation', {
        p_queue_id: input.queueId,
        p_resolution: input.resolution,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.moderation._def });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace._def });
    },
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Expo Go for all testing | EAS Build development client | Required for NFC | Guards need physical devices with dev builds for NFC testing |
| Guard tab layout (3 tabs) | Guard tab layout (5 tabs) | Phase 14 | Add Patrol and Incidents tabs |
| Admin sidebar (6 sections) | Admin sidebar (10 sections) | Phase 14 | Add Providers, Parking, Moves, Marketplace sections |

**Not deprecated:** All existing patterns remain valid. This phase extends, does not replace.

---

## Open Questions

1. **NFC tag procurement and programming**
   - What we know: Database stores NFC serial numbers in `patrol_checkpoints`. The app reads NFC serials from physical tags.
   - What's unclear: Who programs the NFC tags? Are they pre-programmed or just read factory serials? The schema uses factory serial numbers (comment: "factory-assigned, not UUID"), suggesting just reading existing IDs.
   - Recommendation: Assume factory serial read-only approach. Admin creates checkpoint records with the NFC serial after scanning a tag. No NFC writing needed.

2. **EAS Build requirement for NFC**
   - What we know: `react-native-nfc-manager` is a native module that requires custom builds.
   - What's unclear: Whether the team has EAS Build configured and can create development builds.
   - Recommendation: Plan should include a task for configuring `app.json` plugins and building a dev client. NFC cannot be tested in Expo Go.

3. **Marketplace categories management scope (AMRKT-03)**
   - What we know: Categories are a PostgreSQL enum (`listing_category`), not a table. Enums cannot be dynamically managed.
   - What's unclear: Does "manage categories" mean adding new ones, or just enabling/disabling existing ones per community?
   - Recommendation: Implement as enable/disable toggles per community using `community_settings` JSON. If dynamic categories are needed later, a migration to create a `marketplace_categories` table can be added.

4. **Provider verification at gate (GEMRG-04)**
   - What we know: `is_provider_access_allowed(provider_id, check_time)` function exists. Guards can view active providers and authorized personnel.
   - What's unclear: Whether this is a separate screen or integrated into the gate check-in flow.
   - Recommendation: Add a "Verificar Proveedor" action on the gate screen that queries provider personnel by name/INE and checks `is_provider_access_allowed()`.

---

## Sources

### Primary (HIGH confidence)
- Database migrations directly inspected (all table schemas, enums, triggers, functions, RLS policies)
- Existing codebase: `packages/mobile/app/(guard)/_layout.tsx`, `packages/mobile/src/hooks/useGateOps.ts`, `packages/admin/src/app/(dashboard)/layout.tsx`, `packages/shared/src/queries/keys.ts`
- `packages/mobile/package.json` and `packages/admin/package.json` for installed dependencies

### Secondary (MEDIUM confidence)
- [react-native-nfc-manager GitHub wiki - Expo Go](https://github.com/revtel/react-native-nfc-manager/wiki/Expo-Go) - Expo config plugin setup
- [react-native-nfc-manager npm](https://www.npmjs.com/package/react-native-nfc-manager) - Current version v3.17.x
- [react-native-nfc-manager config plugin issue #757](https://github.com/revtel/react-native-nfc-manager/issues/757) - @expo/config-plugins compatibility

### Tertiary (LOW confidence)
- expo-location and expo-haptics versions estimated from Expo SDK 54 compatibility. Should verify exact compatible versions via `npx expo install`.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified against package.json and existing codebase patterns
- Architecture: HIGH - Follows established patterns from Phases 10-13, verified file structure
- Database schema: HIGH - Directly inspected all migration files, confirmed table existence/absence
- NFC integration: MEDIUM - Library exists and has Expo plugin, but version compatibility with Expo SDK 54 should be verified
- Pitfalls: HIGH - Based on actual codebase inspection and known project conventions

**Research date:** 2026-02-08
**Valid until:** 2026-03-08 (30 days -- stable domain, no fast-moving dependencies)
