# Phase 13 Plan 02: Amenity Reservation System Summary

**One-liner:** Built complete amenity reservation flow with react-native-calendars: catalog grid, availability calendar with booking dots, hourly time slot picker, reservation creation via create_reservation() RPC, my reservations list with upcoming/past tabs, and reservation detail with cancellation.

## What Was Built

### Reservation Hooks (packages/mobile/src/hooks/useReservations.ts)
- **useAmenities():** Fetches active amenities for the community, ordered by name
- **useAmenityDetail(id):** Fetches single amenity with all fields
- **useAmenityReservations(amenityId, month):** Fetches confirmed/pending reservations, client-side month filtering (PostgREST range operators unreliable for tstzrange)
- **useCreateReservation():** RPC mutation calling `create_reservation()` with p_amenity_id, p_unit_id, p_resident_id, p_start_time, p_end_time, p_notes
- **useMyReservations():** Fetches resident's reservations with amenity join, ordered by created_at desc
- **useCancelReservation():** Updates reservation status to 'cancelled' with cancelled_at, cancelled_by, cancellation_reason
- **parseTstzrange():** Helper parsing PostgreSQL tstzrange format `["2026-02-08 10:00:00+00","2026-02-08 12:00:00+00")` into Date objects

### Amenity Components
- **AmenityCard:** Grid card with photo (or placeholder), name, amenity_type badge, location, capacity, hourly rate. Tap navigates to detail.
- **AvailabilityCalendar:** react-native-calendars Calendar component showing booked dates with orange/red dots (threshold: 3+ = red). Legend for dot colors. Month navigation updates reservation query. Past dates disabled.
- **TimeSlotPicker:** Horizontal scroll of hourly slots (8am-9pm). Booked slots grayed out. Selection supports start+extend pattern for multi-hour booking. Summary chip shows selected range and duration.

### Screens
- **amenities/index.tsx:** 2-column FlatList grid with AmenityCard items, back button, link to My Reservations, pull-to-refresh, empty state
- **amenities/[id].tsx:** Hero photo, name, type badge, location, description, capacity/rate/deposit info cards. AvailabilityCalendar + TimeSlotPicker below. Fixed "Reservar" button at bottom when slot selected. Free-use notice for non-reservable amenities.
- **amenities/reserve.tsx:** Confirmation screen with amenity name, date, time range, estimated cost calculation (hours * hourly_rate), deposit notice, optional notes TextInput, confirm button with loading state. Success/error alerts.
- **reservations/index.tsx:** My reservations list with segmented upcoming/past tabs. Upcoming: future confirmed/pending. Past: everything else. Reservation cards show amenity name, date, time range, status badge. Tap to detail.
- **reservations/[id].tsx:** Full reservation detail: amenity photo, name, date/time, location, notes, created_at. Cancel form with reason input for future confirmed/pending. Cancelled reservations show cancelled_at and reason.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Client-side month filtering for reservations | PostgREST range operators for tstzrange are unreliable; fetch all and filter in JS |
| Local MarkedDates type definition | react-native-calendars exports MarkedDates from internal types module, not from main index |
| Hourly slots 8am-9pm default | Standard operating hours; amenity schedule JSONB is opaque per research guidance |
| Start+extend slot selection pattern | More intuitive than separate start/end pickers; supports multi-hour bookings |
| Use `as never` cast for reservation status enums | Consistent with project pattern; database types not regenerated |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] MarkedDates type import from react-native-calendars**
- **Found during:** Task 2
- **Issue:** `MarkedDates` type is exported from `react-native-calendars/src/types` but not re-exported from the main index
- **Fix:** Defined local `MarkedDates` type inline in AvailabilityCalendar.tsx
- **Files modified:** packages/mobile/src/components/amenities/AvailabilityCalendar.tsx

**2. [Rule 3 - Blocking] stylesheet.calendar.header not in Theme type**
- **Found during:** Task 2
- **Issue:** Calendar theme's `stylesheet.calendar.header` uses string key syntax not matching the typed `stylesheet` property
- **Fix:** Replaced with `weekVerticalMargin` theme property (achieves same visual effect, properly typed)
- **Files modified:** packages/mobile/src/components/amenities/AvailabilityCalendar.tsx

**3. [Rule 2 - Missing Critical] Added detail and myReservations to amenities query keys**
- **Found during:** Task 1
- **Issue:** Amenity query key factory lacked `detail` and `myReservations` keys needed by new hooks
- **Fix:** Added `detail: (id: string) => [id]` and `myReservations: (residentId: string) => [{ residentId }]` to amenities factory
- **Files modified:** packages/shared/src/queries/keys.ts

## Commit Log

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 452121d | Install react-native-calendars, create 6 reservation hooks + parseTstzrange helper |
| 2 | 3e04bb9 | Add 5 route screens + 3 amenity components |

## Files Created/Modified

### Created
- `packages/mobile/src/hooks/useReservations.ts`
- `packages/mobile/src/components/amenities/AmenityCard.tsx`
- `packages/mobile/src/components/amenities/AvailabilityCalendar.tsx`
- `packages/mobile/src/components/amenities/TimeSlotPicker.tsx`
- `packages/mobile/app/(resident)/community/amenities/index.tsx`
- `packages/mobile/app/(resident)/community/amenities/[id].tsx`
- `packages/mobile/app/(resident)/community/amenities/reserve.tsx`
- `packages/mobile/app/(resident)/community/reservations/index.tsx`
- `packages/mobile/app/(resident)/community/reservations/[id].tsx`

### Modified
- `packages/shared/src/queries/keys.ts` (added detail + myReservations keys)
- `packages/mobile/package.json` (added react-native-calendars dependency)
- `pnpm-lock.yaml` (updated)

## Verification Results

- TypeScript compilation passes in packages/shared (no errors)
- TypeScript compilation passes in packages/mobile (no errors)
- react-native-calendars ^1.1314.0 installed and importable
- All 5 route files exist (amenities/index, amenities/[id], amenities/reserve, reservations/index, reservations/[id])
- All 3 component files exist (AmenityCard, AvailabilityCalendar, TimeSlotPicker)
- Calendar import from react-native-calendars compiles successfully
- 6 hooks + parseTstzrange exported from useReservations.ts
- create_reservation RPC called with correct parameters (p_amenity_id, p_unit_id, p_resident_id, p_start_time, p_end_time, p_notes)
- Cancellation updates status with cancelled_at, cancelled_by, cancellation_reason

## Next Phase Readiness

- **Plan 13-03** (Profile + Documents + Marketplace): Independent; no blockers from this plan
- **Plan 13-04** (Surveys/Voting): Independent; no blockers
- **Blocker:** Migration 20260208210500 from 13-01 must be applied for RLS policies to work with reservation queries

## Metrics

- **Duration:** ~8 min
- **Completed:** 2026-02-08
- **Tasks:** 2/2
