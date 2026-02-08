-- Migration: shift_handovers table
-- Phase 14: Guard Advanced + Admin Providers/Parking/Moves
-- Purpose: Guard shift handover notes between shifts

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
