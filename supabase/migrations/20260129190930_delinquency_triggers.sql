-- Migration: delinquency_triggers
-- Phase 4 Plan 03: Delinquency management
-- Purpose: Configurable escalation rules and audit log for collection actions

-- =====================================================
-- delinquency_triggers TABLE
-- =====================================================
-- Configurable rules mapping days overdue to automated actions
-- Each community can define their own escalation workflow

CREATE TABLE delinquency_triggers (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Trigger condition
  days_overdue INTEGER NOT NULL,                         -- Trigger at this many days overdue
  min_amount money_amount NOT NULL DEFAULT 0,            -- Only trigger if balance >= this amount

  -- Action to take
  action_type delinquency_action_type NOT NULL,
  action_config JSONB NOT NULL DEFAULT '{}',             -- Action-specific configuration

  -- Template reference (for email/SMS actions)
  notification_template_id UUID,                         -- FK to future templates table

  -- Fee details (for late_fee, interest_charge actions)
  fee_amount money_amount,                               -- Fixed fee amount
  fee_percentage NUMERIC(5,2),                           -- Percentage-based fee
  fee_description TEXT,                                  -- Description for transaction

  -- Repeat behavior
  is_one_time BOOLEAN NOT NULL DEFAULT TRUE,             -- Execute only once per delinquent period
  repeat_interval_days INTEGER,                          -- If not one-time, repeat every N days

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 1,                   -- Lower = higher priority (executed first)

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),

  -- Unique constraint: one action type per days_overdue threshold per community
  CONSTRAINT delinquency_triggers_unique UNIQUE (community_id, days_overdue, action_type),

  -- Validation
  CONSTRAINT delinquency_triggers_days_positive CHECK (days_overdue >= 0),
  CONSTRAINT delinquency_triggers_min_amount_positive CHECK (min_amount >= 0),
  CONSTRAINT delinquency_triggers_fee_percentage_valid CHECK (
    fee_percentage IS NULL OR (fee_percentage > 0 AND fee_percentage <= 100)
  ),
  CONSTRAINT delinquency_triggers_repeat_interval_valid CHECK (
    is_one_time = TRUE OR repeat_interval_days > 0
  )
);

-- =====================================================
-- delinquency_actions TABLE (AUDIT LOG)
-- =====================================================
-- Log of all delinquency actions taken
-- NO SOFT DELETE - this is a permanent audit trail

CREATE TABLE delinquency_actions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  trigger_id UUID REFERENCES delinquency_triggers(id) ON DELETE SET NULL, -- Keep action even if trigger deleted
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,

  -- What was done
  action_type delinquency_action_type NOT NULL,
  action_description TEXT NOT NULL,

  -- Related records
  related_transaction_id UUID REFERENCES transactions(id), -- If fee/interest was charged
  related_notification_id UUID,                            -- If notification was sent

  -- Balance snapshot at time of action
  balance_at_action money_amount NOT NULL,
  days_overdue_at_action INTEGER NOT NULL,

  -- Execution result
  status TEXT NOT NULL DEFAULT 'executed'
    CHECK (status IN ('executed', 'failed', 'skipped')),
  failure_reason TEXT,

  -- Execution audit
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_by UUID REFERENCES auth.users(id),

  -- NO deleted_at - this is an immutable audit log
  -- NO updated_at - entries are never modified

  -- Validation
  CONSTRAINT delinquency_actions_days_positive CHECK (days_overdue_at_action >= 0)
);

-- =====================================================
-- INDEXES
-- =====================================================

-- delinquency_triggers: lookup active triggers for a community
CREATE INDEX idx_delinquency_triggers_community_active ON delinquency_triggers(
  community_id, days_overdue, is_active
) WHERE deleted_at IS NULL AND is_active = TRUE;

-- delinquency_triggers: by priority for execution order
CREATE INDEX idx_delinquency_triggers_priority ON delinquency_triggers(
  community_id, priority, days_overdue
) WHERE deleted_at IS NULL AND is_active = TRUE;

-- delinquency_actions: unit history
CREATE INDEX idx_delinquency_actions_unit ON delinquency_actions(
  unit_id, executed_at DESC
);

-- delinquency_actions: community history (for admin reports)
CREATE INDEX idx_delinquency_actions_community ON delinquency_actions(
  community_id, executed_at DESC
);

-- delinquency_actions: by status (for failed action review)
CREATE INDEX idx_delinquency_actions_status ON delinquency_actions(
  community_id, status
) WHERE status = 'failed';

-- =====================================================
-- TRIGGERS
-- =====================================================

-- delinquency_triggers: Audit fields
CREATE TRIGGER set_delinquency_triggers_audit
  BEFORE INSERT OR UPDATE ON delinquency_triggers
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- delinquency_triggers: Soft delete support
CREATE TRIGGER delinquency_triggers_soft_delete
  BEFORE DELETE ON delinquency_triggers
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete();

-- delinquency_actions: IMMUTABLE - prevent modification (same pattern as access_logs)
CREATE OR REPLACE FUNCTION prevent_delinquency_action_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'delinquency_actions is append-only: % operations are not allowed', TG_OP;
END;
$$;

CREATE TRIGGER delinquency_actions_immutable_update
  BEFORE UPDATE ON delinquency_actions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delinquency_action_modification();

CREATE TRIGGER delinquency_actions_immutable_delete
  BEFORE DELETE ON delinquency_actions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_delinquency_action_modification();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE delinquency_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE delinquency_actions ENABLE ROW LEVEL SECURITY;

-- Super admins can access all
CREATE POLICY super_admin_all_delinquency_triggers ON delinquency_triggers
  FOR ALL
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'super_admin');

CREATE POLICY super_admin_all_delinquency_actions ON delinquency_actions
  FOR ALL
  TO authenticated
  USING ((SELECT get_current_user_role()) = 'super_admin');

-- Admins can view and manage triggers for their community
CREATE POLICY admins_view_delinquency_triggers ON delinquency_triggers
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

CREATE POLICY admins_manage_delinquency_triggers ON delinquency_triggers
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

-- Admins can view all actions for their community
CREATE POLICY admins_view_delinquency_actions ON delinquency_actions
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

-- Admins can insert actions (execution logging)
CREATE POLICY admins_insert_delinquency_actions ON delinquency_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) = 'admin'
  );

-- Residents can view actions on their own units
CREATE POLICY users_view_own_delinquency_actions ON delinquency_actions
  FOR SELECT
  TO authenticated
  USING (
    unit_id IN (
      SELECT unit_id FROM occupancies
      WHERE resident_id = auth.uid()
        AND deleted_at IS NULL
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE delinquency_triggers IS
  'Configurable escalation rules: days overdue -> action.
   Typical progression for Mexican HOAs:
   - 1 day: reminder email
   - 15 days: late fee (1-5% of balance or fixed amount)
   - 30 days: interest charge starts (per interest_rules)
   - 60 days: service restriction (amenity access)
   - 90 days: legal warning letter
   - 180 days: collection referral or legal action
   Each community configures their own escalation based on assembly rules.';

COMMENT ON COLUMN delinquency_triggers.action_config IS
  'Action-specific configuration as JSONB. Examples:
   - reminder_email: {"template": "friendly", "include_balance": true}
   - service_restriction: {"restrict": ["gym", "pool", "salon"]}
   - payment_plan_offer: {"max_installments": 12, "min_down_payment_pct": 20}';

COMMENT ON COLUMN delinquency_triggers.is_one_time IS
  'If true, action executes only once per delinquent period.
   If false, repeats every repeat_interval_days until paid.';

COMMENT ON TABLE delinquency_actions IS
  'Immutable audit log of all delinquency enforcement actions.
   NO soft delete or updates - permanent record for compliance and disputes.
   Links to related transaction when fees are charged.
   Links to trigger that caused the action (SET NULL if trigger deleted).';

COMMENT ON COLUMN delinquency_actions.balance_at_action IS
  'Snapshot of unit balance at time of action for audit trail.';

COMMENT ON COLUMN delinquency_actions.related_transaction_id IS
  'References the transaction created when a fee or interest charge was applied.';
