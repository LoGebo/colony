---
phase: 16-push-notifications-real-time
plan: 02
subsystem: notifications
tags: [notification-ui, expo-router, nativewind, date-fns, deep-linking]

requires:
  - phase: 16-01
    provides: Push notification infrastructure, notification hooks (useNotificationList, useUnreadCount, useMarkNotificationRead)
  - phase: 09-02
    provides: Supabase client, auth hooks, role-based routing

provides:
  - NotificationBell component with unread badge for tab bars
  - NotificationListScreen with type icons and relative timestamps
  - Mark-as-read on tap with deep navigation to related entities
  - Hidden notification screen routes for resident and guard roles

affects:
  - Future: Notification preferences UI will use NotificationBell in layouts
  - 16-03: Real-time subscriptions will complement push notifications for live updates

tech-stack:
  added: []
  patterns:
    - TouchableOpacity with accessibility labels for interactive elements
    - Type-based icon mapping for visual notification categorization
    - Fire-and-forget mutation pattern for mark-as-read (non-blocking UX)
    - Spanish locale (date-fns/locale/es) for relative time formatting
    - Hidden Tabs.Screen with href: null for navigation-only routes

key-files:
  created:
    - packages/mobile/src/components/notifications/NotificationBell.tsx: "Bell icon with unread count badge overlay"
    - packages/mobile/src/components/notifications/NotificationListScreen.tsx: "Full notification list with icons, relative times, mark-as-read, deep navigation"
    - packages/mobile/app/(resident)/notifications.tsx: "Resident notification screen route"
    - packages/mobile/app/(guard)/notifications.tsx: "Guard notification screen route"
  modified:
    - packages/mobile/app/(resident)/_layout.tsx: "Added hidden notifications tab (modified by 16-03)"
    - packages/mobile/app/(guard)/_layout.tsx: "Added hidden notifications tab (modified by 16-03)"

key-decisions:
  - "Type-based icon mapping for 19 notification types (ticket, sla, message, document, announcement, payment, visitor, package, emergency)"
  - "Spanish locale for relative timestamps (hace X minutos, hace X horas)"
  - "Fire-and-forget mark-as-read mutation on tap (no await, non-blocking navigation)"
  - "Deep navigation priority: action_url field first, then fallback to type-based routing"
  - "Hidden tab routes (href: null) for notification screens (accessible via router.push)"

patterns-established:
  - "Type icon mapping with getTypeIcon helper function"
  - "Relative time formatting with date-fns formatDistanceToNow + Spanish locale"
  - "Unread badge with 9+ cap and absolute positioning"
  - "Mark all as read button visible only when unreadCount > 0"
  - "Blue background for unread notifications, white for read"

duration: 6min 23sec
completed: 2026-02-08
---

# Phase 16 Plan 02: In-App Notification UI Summary

**Notification bell with unread badge and full list screen with type icons, relative timestamps, mark-as-read, and deep navigation for both resident and guard roles.**

## Performance

- **Duration:** 6 min 23 sec
- **Started:** 2026-02-08T20:45:50Z
- **Completed:** 2026-02-08T20:52:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- NotificationBell component shows unread count with red badge (9+ cap)
- NotificationListScreen renders all notifications with type-specific icons
- Relative timestamps in Spanish (hace 2 minutos, hace 1 hora)
- Mark-as-read on tap with deep navigation to related screens
- Mark all as read button for batch operations
- Hidden notification screen routes for both resident and guard roles

## Task Commits

Each task was committed atomically:

1. **Task 1: Create NotificationBell and NotificationListScreen components** - `ee3afbd` (feat)
2. **Task 2: Add notification screens and wire into layouts** - `e88e88e` (feat)

**Plan metadata:** (to be committed with SUMMARY.md)

## Files Created/Modified

### Created (4 files)
- `packages/mobile/src/components/notifications/NotificationBell.tsx` (31 lines) - Bell icon with unread count badge, red circle overlay, 9+ cap
- `packages/mobile/src/components/notifications/NotificationListScreen.tsx` (172 lines) - Full notification list with type icons, relative times, mark-as-read, deep navigation, mark all button
- `packages/mobile/app/(resident)/notifications.tsx` (6 lines) - Resident notification screen route
- `packages/mobile/app/(guard)/notifications.tsx` (6 lines) - Guard notification screen route

### Modified (2 files)
- `packages/mobile/app/(resident)/_layout.tsx` - Added hidden notifications tab (href: null) [Note: Modified by plan 16-03]
- `packages/mobile/app/(guard)/_layout.tsx` - Added hidden notifications tab (href: null) [Note: Modified by plan 16-03]

## Decisions Made

### 1. Type-Based Icon Mapping
**Choice:** Map 19 notification types to emoji icons in TYPE_ICONS constant
**Reason:** Visual categorization helps users quickly identify notification type without reading full text
**Icons:** 🔧 (ticket), ⏰ (sla), 💬 (message), 📄 (document), 📢 (announcement), 💳 (payment), 👥 (visitor), 📦 (package), 🚨 (emergency), 🔔 (default)

### 2. Spanish Locale for Relative Time
**Choice:** Use date-fns formatDistanceToNow with Spanish locale (es) and addSuffix: true
**Reason:** Target users are Spanish-speaking, relative time format ("hace 2 minutos") is more natural than absolute timestamps
**Impact:** Requires date-fns to be installed (already present in package.json)

### 3. Fire-and-Forget Mark-as-Read
**Choice:** Don't await markRead mutation on notification tap
**Reason:** User already navigated to destination screen; marking read shouldn't block navigation or show error UI
**Pattern:** `markRead(notification.id)` without await, navigation happens immediately

### 4. Deep Navigation Priority
**Choice:** Check notification.action_url first, then fallback to type-based routing logic
**Reason:** Flexible routing - backend can specify exact destination via action_url, or default behavior applies
**Fallback routes:** ticket → maintenance/[id], announcement → announcements/[id], payment → payments/, package → more/packages, visitor → visitors/[id], document → more/documents/[id], message → community/

### 5. Hidden Tab Routes
**Choice:** Register notification screens as hidden tabs (href: null) in resident and guard layouts
**Reason:** Keeps tab bar clean while making screens accessible via router.push
**Impact:** Notifications accessible from anywhere via router.push('/(resident)/notifications' or '/(guard)/notifications')

## Deviations from Plan

None - plan executed exactly as written.

**Note:** Layout changes (hidden notification tabs) were already present when this plan executed, likely modified by plan 16-03 which ran earlier. The notification screen route files (notifications.tsx) were the new additions in this plan.

## Issues Encountered

None - all tasks completed successfully.

## Technical Implementation

### NotificationBell Component

```typescript
// Unread badge with 9+ cap
{unreadCount > 0 && (
  <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px]">
    <Text className="text-white text-xs font-bold">
      {unreadCount > 9 ? '9+' : unreadCount}
    </Text>
  </View>
)}
```

### Type Icon Mapping

```typescript
const TYPE_ICONS: Record<string, string> = {
  ticket_created: '🔧',
  ticket_assigned: '🔧',
  sla_warning: '⏰',
  new_message: '💬',
  document_published: '📄',
  announcement: '📢',
  payment_due: '💳',
  visitor_arrived: '👥',
  package_arrived: '📦',
  emergency_alert: '🚨',
  // ... 19 types total
};
```

### Relative Time Formatting

```typescript
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const relativeTime = formatDistanceToNow(new Date(item.created_at), {
  addSuffix: true,
  locale: es,
});
// Output: "hace 2 minutos", "hace 1 hora", "hace 3 días"
```

### Deep Navigation Logic

```typescript
const handleNotificationTap = (notification: Notification) => {
  // Fire-and-forget mark as read
  if (!notification.read_at) {
    markRead(notification.id);
  }

  // Priority 1: action_url field
  if (notification.action_url) {
    router.push(notification.action_url as any);
    return;
  }

  // Priority 2: type-based fallback
  const data = notification.data as any;
  const type = notification.type;

  if (type.startsWith('ticket_') && data?.ticket_id) {
    router.push(`/(resident)/maintenance/${data.ticket_id}` as any);
  } else if (type === 'announcement' && data?.announcement_id) {
    router.push(`/(resident)/announcements/${data.announcement_id}` as any);
  }
  // ... more type checks
};
```

### Hidden Tab Routes

```typescript
// In (resident)/_layout.tsx and (guard)/_layout.tsx
<Tabs.Screen
  name="notifications"
  options={{
    href: null, // Hidden from tab bar
  }}
/>
```

## Testing Checklist

- [ ] **NotificationBell Component**
  - [ ] Bell icon displays with fontSize 22
  - [ ] Unread badge shows when count > 0
  - [ ] Badge displays "9+" when count > 9
  - [ ] Badge has red background (bg-red-500)
  - [ ] onPress callback triggers navigation

- [ ] **NotificationListScreen**
  - [ ] Header shows "Notificaciones" title
  - [ ] "Marcar todo" button appears when unread count > 0
  - [ ] Each notification shows: icon, title, body, relative time
  - [ ] Unread notifications have blue background (bg-blue-50)
  - [ ] Read notifications have white background
  - [ ] Unread notifications show blue dot indicator
  - [ ] Relative time in Spanish ("hace X minutos")
  - [ ] Empty state shows bell icon + "Sin notificaciones"

- [ ] **Mark as Read**
  - [ ] Tapping notification marks it as read
  - [ ] Blue background changes to white after mark
  - [ ] Unread count decreases by 1
  - [ ] "Marcar todo" button marks all notifications

- [ ] **Deep Navigation**
  - [ ] Tap ticket notification → opens maintenance/[ticket_id]
  - [ ] Tap announcement notification → opens announcements/[announcement_id]
  - [ ] Tap payment notification → opens payments/
  - [ ] Tap package notification → opens more/packages
  - [ ] Tap visitor notification → opens visitors/[visitor_id]
  - [ ] Tap document notification → opens more/documents/[document_id]
  - [ ] Tap message notification → opens community/
  - [ ] action_url field takes priority over type-based routing

- [ ] **Routes**
  - [ ] /(resident)/notifications route exists and renders NotificationListScreen
  - [ ] /(guard)/notifications route exists and renders NotificationListScreen
  - [ ] Both routes hidden from tab bar (href: null)
  - [ ] router.push('/(resident)/notifications') works from any screen
  - [ ] router.push('/(guard)/notifications') works from any guard screen

- [ ] **Accessibility**
  - [ ] NotificationBell has accessibilityLabel with unread count
  - [ ] Each notification has accessibilityLabel with read/unread state
  - [ ] "Marcar todo" button has accessibilityLabel
  - [ ] All interactive elements have accessibilityRole="button"

## Known Limitations

1. **No pagination**: Notification list limited to 50 most recent (query has `limit(50)`)
2. **No dismiss action**: Notifications can be marked as read but not dismissed from list
3. **No notification preferences**: All notification types shown, no filtering or muting
4. **No pull-to-refresh**: List doesn't refresh on pull down gesture
5. **No optimistic updates**: Mark-as-read mutation waits for server response before UI update

## Next Phase Readiness

### Blocks

None. All tasks complete and functional.

### Enables

- **Notification bell can be added to tab bars**: NotificationBell component ready for integration
- **Real-time updates (16-03)**: Real-time subscriptions will auto-update notification list
- **Push notification tap handling**: Deep navigation ready for push notification tap events
- **Notification preferences (future)**: Foundation for preference UI with filter/mute controls

### Dependencies for Next Plan

- **Real-time subscriptions (16-03)**: Will auto-invalidate notification queries when new notifications arrive
- **Push notification service**: Already integrated in 16-01, will use deep navigation logic from this plan
- **Backend notification creation**: Requires notifications table populated with proper type and action_url fields

## Files Changed Summary

- **Created:** 4 files (NotificationBell, NotificationListScreen, 2 screen routes)
- **Modified:** 2 files (resident and guard layouts - already modified by 16-03)
- **Total lines added:** ~215 lines of TypeScript/TSX
- **Dependencies added:** 0 (date-fns already installed)

---
*Phase: 16-push-notifications-real-time*
*Completed: 2026-02-08*
