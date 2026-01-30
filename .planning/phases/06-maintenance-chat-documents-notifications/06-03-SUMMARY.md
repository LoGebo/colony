---
phase: 06-maintenance-chat-documents-notifications
plan: 03
subsystem: chat-messaging
tags: [chat, conversations, messages, realtime, pg_notify, reactions]
depends_on:
  requires:
    - 01-02 (RLS helpers, audit triggers)
    - 03-01 (access_points for guard_booth conversations)
  provides:
    - conversation_type enum (4 types)
    - participant_role enum (4 roles)
    - conversations table
    - conversation_participants table
    - messages table with edit/delete
    - message_read_receipts table
    - message_reactions table
    - quick_responses table
  affects:
    - 06-05 (push notifications will integrate with chat)
tech-stack:
  added: []
  patterns:
    - Denormalized counts via triggers (participant_count, message_count, unread_count)
    - pg_notify for real-time message delivery
    - Spanish full-text search with GIN index
    - Idempotent migrations with IF NOT EXISTS
key-files:
  created:
    - supabase/migrations/20260129235825_chat_enums_idempotent.sql
    - supabase/migrations/20260129235848_conversations_tables.sql
    - supabase/migrations/20260130000113_messages_tables.sql
    - supabase/migrations/20260130000243_chat_notifications.sql
  modified: []
decisions:
  - id: denormalized-counts
    choice: "Trigger-maintained participant_count, message_count, unread_count"
    reason: "O(1) reads for conversation list, badge display without COUNT(*) queries"
  - id: pg-notify-pattern
    choice: "pg_notify for new_message and typing channels"
    reason: "Supabase Realtime subscribes to these for instant WebSocket push"
  - id: spanish-fts
    choice: "Spanish dictionary for full-text search"
    reason: "Mexican Spanish stemming for accurate search results"
  - id: soft-delete-messages
    choice: "is_deleted flag, clear content but keep record"
    reason: "Shows 'This message was deleted' in UI, preserves conversation structure"
metrics:
  duration: "19 min"
  completed: "2026-01-29"
---

# Phase 6 Plan 3: Chat Messaging Infrastructure Summary

Real-time chat system with conversations, participants, messages, read receipts, and reactions for UPOE messaging.

## One-Liner

Complete chat infrastructure with 4 conversation types, role-based participants, message history with edits/reactions, and Spanish full-text search.

## What Was Built

### Enum Types (2)

1. **conversation_type** - 4 conversation patterns:
   - direct (1:1 between two users)
   - group (multi-user named conversations)
   - guard_booth (resident-guard per shift/gate)
   - support (resident-admin communication)

2. **participant_role** - 4 participant roles:
   - owner (full control)
   - admin (manage members)
   - member (regular participant)
   - guard (guard_booth specific)

### Tables (6)

1. **conversations** - Chat conversation container
   - Type-specific constraints (guard_booth requires access_point_id + shift_date)
   - Group conversations require name
   - Denormalized counts (participant_count, message_count)
   - Last message preview for list display
   - Community-scoped with RLS

2. **conversation_participants** - Membership and settings
   - Role assignment per conversation
   - Mute settings (is_muted, muted_until)
   - Read tracking (last_read_message_id, unread_count)
   - Unique constraint per user per conversation

3. **messages** - Chat message content
   - Text and media support (media_urls, media_types)
   - Threaded replies (reply_to_message_id)
   - Message types (text, image, file, audio, video, system)
   - Edit tracking (original_content preserved)
   - Soft delete for "message deleted" display

4. **message_read_receipts** - Per-user read tracking
   - Unique per message per user
   - Used for read status indicators

5. **message_reactions** - Emoji reactions
   - Unique per message per user per reaction type
   - Supports emoji codes (thumbs_up, heart, laugh, etc.)

6. **quick_responses** - Guard canned messages
   - Categorized (greeting, visitor, delivery, emergency)
   - Community-scoped with sort order

### Functions (8)

1. **update_conversation_participant_count()** - Trigger for participant count
2. **find_or_create_direct_conversation()** - Creates or finds 1:1 conversations
3. **get_or_create_guard_booth()** - Creates guard booth for gate+date
4. **update_conversation_on_message()** - Trigger updating stats on new message
5. **mark_messages_read()** - Batch mark messages as read, reset unread
6. **edit_message()** - Edit with original content preservation
7. **delete_message()** - Soft delete clearing content
8. **notify_new_message()** - pg_notify trigger for real-time
9. **notify_typing()** - RPC for typing indicators
10. **get_unread_conversations_count()** - Badge count helper
11. **get_conversation_list()** - Conversation list with previews
12. **search_messages()** - Spanish full-text search

### Indexes (9)

1. idx_conversations_community_list - Conversation list ordering
2. idx_conversations_guard_booth - Gate+date lookup
3. idx_participants_user_active - User's active conversations
4. idx_participants_conversation_active - Conversation's members
5. idx_participants_last_read - Read tracking
6. idx_messages_conversation_history - Message chronological order
7. idx_read_receipts_message - Read count by message
8. idx_reactions_message - Reaction aggregation
9. idx_messages_content_search - GIN for Spanish FTS

### RLS Policies (15 total)

All tables have comprehensive RLS:
- Conversations: participant-based access, super_admin override
- Messages: participants can view/send, sender-based insert
- Read receipts: participant view, user insert own
- Reactions: participant view, user insert/delete own
- Quick responses: community users view, admins manage

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Denormalized counts | O(1) reads for conversation list and badge display |
| pg_notify pattern | Supabase Realtime subscribes for instant WebSocket push |
| Spanish FTS | Mexican Spanish stemming for accurate search |
| Soft delete messages | Preserves structure, shows "deleted" in UI |
| Guard booth per date | One conversation per gate per day for shift continuity |

## Deviations from Plan

None - plan executed exactly as written.

## Commit History

| Commit | Message | Files |
|--------|---------|-------|
| bd9373a | feat(06-03): create chat enums and conversations tables | 2 files |
| a9c705a | feat(06-03): create messages, read receipts, and reactions tables | 1 file |
| b86bd24 | feat(06-03): create chat notifications and helper functions | 1 file |

## Success Criteria Verification

- [x] conversation_type enum has 4 values (direct, group, guard_booth, support)
- [x] participant_role enum has 4 values (owner, admin, member, guard)
- [x] conversations table with type-specific constraints
- [x] conversation_participants with roles, muting, and unread tracking
- [x] messages table with text, media, replies, edits, and soft delete
- [x] message_read_receipts for per-user tracking
- [x] message_reactions with emoji codes and unique constraint
- [x] quick_responses for guard canned messages
- [x] Triggers maintain denormalized counts
- [x] pg_notify for real-time message delivery
- [x] Full-text search with Spanish dictionary
- [x] RLS ensures users only access their conversations

## Next Phase Readiness

**Ready for 06-05 (Push Notifications):**
- Chat tables available for notification integration
- pg_notify pattern established for real-time
- Participant mute settings ready for notification filtering

**Dependencies satisfied:**
- communities table (from 01-02)
- auth.users (Supabase built-in)
- access_points table (from 03-01)
- residents table (from 02-01)
- set_audit_fields() function (from 01-01)
- generate_uuid_v7() function (from 01-01)
- is_super_admin() function (from 01-02)
- get_current_community_id() function (from 01-02)

## Files Created

```
supabase/migrations/
  20260129235825_chat_enums_idempotent.sql      (42 lines)
  20260129235848_conversations_tables.sql       (489 lines)
  20260130000113_messages_tables.sql            (476 lines)
  20260130000243_chat_notifications.sql         (333 lines)
```

Total: 1,340 lines of SQL
