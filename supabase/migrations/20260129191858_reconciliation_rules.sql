-- ============================================
-- RECONCILIATION RULES TABLE
-- ============================================
-- Phase 4 Plan 04: Bank Reconciliation
--
-- Configurable rules for automatic matching of bank statement lines
-- to transactions. Rules are evaluated in priority order (lower = first).

CREATE TABLE reconciliation_rules (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Rule identification
  name TEXT NOT NULL,
  description TEXT,

  -- Matching criteria (JSONB for flexibility)
  -- Example: {"description_contains": "SPEI", "amount_tolerance": 0.01}
  -- Supported fields:
  --   - description_contains: string pattern in statement description
  --   - description_regex: regex pattern for description
  --   - reference_contains: string pattern in reference
  --   - amount_tolerance: decimal tolerance for amount matching
  --   - date_tolerance_days: days difference allowed for date matching
  --   - min_amount: minimum amount to apply rule
  --   - max_amount: maximum amount to apply rule
  criteria JSONB NOT NULL,

  -- Processing order (lower = checked first)
  priority INTEGER NOT NULL DEFAULT 100,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Standard audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE reconciliation_rules IS
  'Configurable rules for automatic bank statement reconciliation.
   Rules are evaluated in priority order (lower = first) to match
   statement lines to transactions.';

COMMENT ON COLUMN reconciliation_rules.criteria IS
  'JSONB matching criteria. Supported keys:
   - description_contains: string pattern in description
   - description_regex: regex pattern
   - reference_contains: string pattern in reference
   - amount_tolerance: decimal (e.g., 0.01 for exact match)
   - date_tolerance_days: integer (e.g., 3 for +/- 3 days)
   - min_amount, max_amount: range filters';

COMMENT ON COLUMN reconciliation_rules.priority IS
  'Processing order. Lower values are checked first. Default 100.';

-- ============================================
-- AUDIT TRIGGER
-- ============================================

CREATE TRIGGER reconciliation_rules_audit
  BEFORE INSERT OR UPDATE ON reconciliation_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- INDEXES
-- ============================================

-- Community + active + priority for rule processing
CREATE INDEX idx_reconciliation_rules_community_priority
  ON reconciliation_rules(community_id, priority)
  WHERE is_active = TRUE AND deleted_at IS NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE reconciliation_rules ENABLE ROW LEVEL SECURITY;

-- Super admins have full access
CREATE POLICY "super_admin_all_reconciliation_rules" ON reconciliation_rules FOR ALL TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Only admins can view and manage reconciliation rules
CREATE POLICY "admins_manage_reconciliation_rules" ON reconciliation_rules FOR ALL TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );
