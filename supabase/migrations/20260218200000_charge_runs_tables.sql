-- ============================================
-- PHASE 05: AUTOMATED CHARGE GENERATION
-- ============================================
-- Creates charge_runs and charge_run_items tables
-- for batch tracking and duplicate prevention.
-- Creates generate_monthly_charges() function.

-- ============================================
-- CHARGE RUNS TABLE (batch header)
-- ============================================

CREATE TABLE IF NOT EXISTS charge_runs (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id),
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id),
  period_start DATE NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'reversed')),
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  units_charged INTEGER NOT NULL DEFAULT 0,
  units_skipped INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,

  -- Prevent duplicate charges for same community + fee + period
  CONSTRAINT uq_charge_run_period
    UNIQUE (community_id, fee_structure_id, period_start)
);

CREATE INDEX idx_charge_runs_community
  ON charge_runs (community_id, created_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE charge_runs IS
  'Tracks batch charge generation runs. UNIQUE constraint on
   (community_id, fee_structure_id, period_start) prevents duplicate
   charges for the same billing period.';

-- ============================================
-- CHARGE RUN ITEMS TABLE (per-unit detail)
-- ============================================

CREATE TABLE IF NOT EXISTS charge_run_items (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  charge_run_id UUID NOT NULL REFERENCES charge_runs(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id),
  transaction_id UUID REFERENCES transactions(id),
  amount NUMERIC(15, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'charged'
    CHECK (status IN ('charged', 'skipped', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Each unit appears once per charge run
  CONSTRAINT uq_charge_run_item_unit
    UNIQUE (charge_run_id, unit_id)
);

CREATE INDEX idx_charge_run_items_run
  ON charge_run_items (charge_run_id);

COMMENT ON TABLE charge_run_items IS
  'Per-unit detail for a charge run. Links each unit charge
   to the generated transaction. Tracks skipped/failed units.';

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE charge_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE charge_run_items ENABLE ROW LEVEL SECURITY;

-- Admins can read charge runs for their community
CREATE POLICY "charge_runs_select_admin"
  ON charge_runs FOR SELECT
  USING (
    community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'community_admin', 'manager')
  );

-- Service role writes (admin generates via Supabase client)
CREATE POLICY "charge_runs_insert_admin"
  ON charge_runs FOR INSERT
  WITH CHECK (
    community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'community_admin', 'manager')
  );

-- Admins can read charge run items for runs they can see
CREATE POLICY "charge_run_items_select_admin"
  ON charge_run_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM charge_runs cr
      WHERE cr.id = charge_run_items.charge_run_id
        AND cr.community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'community_admin', 'manager')
    )
  );

CREATE POLICY "charge_run_items_insert_admin"
  ON charge_run_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM charge_runs cr
      WHERE cr.id = charge_run_items.charge_run_id
        AND cr.community_id = (auth.jwt() -> 'app_metadata' ->> 'community_id')::UUID
        AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'community_admin', 'manager')
    )
  );

-- ============================================
-- GENERATE MONTHLY CHARGES FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION generate_monthly_charges(
  p_community_id UUID,
  p_fee_structure_id UUID,
  p_period_start DATE,
  p_description TEXT,
  p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
  charge_run_id UUID,
  units_charged INTEGER,
  units_skipped INTEGER,
  total_amount NUMERIC(15, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_charge_run_id UUID;
  v_unit RECORD;
  v_amount NUMERIC(15, 2);
  v_transaction_id UUID;
  v_total NUMERIC(15, 2) := 0;
  v_charged INTEGER := 0;
  v_skipped INTEGER := 0;
BEGIN
  -- 1. Create charge run header (UNIQUE constraint prevents duplicates)
  INSERT INTO public.charge_runs (
    community_id,
    fee_structure_id,
    period_start,
    description,
    created_by
  ) VALUES (
    p_community_id,
    p_fee_structure_id,
    p_period_start,
    p_description,
    p_created_by
  )
  RETURNING id INTO v_charge_run_id;

  -- 2. Loop through active units in community
  FOR v_unit IN
    SELECT u.id AS unit_id, u.unit_number
    FROM public.units u
    WHERE u.community_id = p_community_id
      AND u.status = 'active'
      AND u.deleted_at IS NULL
    ORDER BY u.unit_number
  LOOP
    BEGIN
      -- Calculate fee amount for this unit (respects overrides and coefficients)
      v_amount := public.get_unit_fee_amount(v_unit.unit_id, p_fee_structure_id, p_period_start);

      IF v_amount IS NULL OR v_amount <= 0 THEN
        -- Skip units with zero or null amount
        INSERT INTO public.charge_run_items (charge_run_id, unit_id, amount, status)
        VALUES (v_charge_run_id, v_unit.unit_id, COALESCE(v_amount, 0), 'skipped');
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Create charge via existing record_charge function
      v_transaction_id := public.record_charge(
        p_community_id,
        v_unit.unit_id,
        v_amount,
        p_period_start,
        p_description,
        p_fee_structure_id,
        p_created_by
      );

      -- Record item
      INSERT INTO public.charge_run_items (
        charge_run_id, unit_id, transaction_id, amount, status
      ) VALUES (
        v_charge_run_id, v_unit.unit_id, v_transaction_id, v_amount, 'charged'
      );

      v_total := v_total + v_amount;
      v_charged := v_charged + 1;

    EXCEPTION WHEN OTHERS THEN
      -- Record failure for this unit but continue with others
      INSERT INTO public.charge_run_items (
        charge_run_id, unit_id, amount, status, error_message
      ) VALUES (
        v_charge_run_id, v_unit.unit_id, COALESCE(v_amount, 0), 'failed', SQLERRM
      );
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  -- 3. Update charge run totals
  UPDATE public.charge_runs
  SET total_amount = v_total,
      units_charged = v_charged,
      units_skipped = v_skipped
  WHERE id = v_charge_run_id;

  -- 4. Return summary
  RETURN QUERY SELECT v_charge_run_id, v_charged, v_skipped, v_total;
END;
$$;

COMMENT ON FUNCTION generate_monthly_charges IS
  'Generates charges for all active units in a community using a fee structure.

   Duplicate prevention: UNIQUE(community_id, fee_structure_id, period_start)
   on charge_runs table. Calling twice for the same period raises 23505.

   Uses record_charge() for each unit (double-entry accounting).
   Tracks results in charge_run_items with per-unit status.
   Continues on individual unit failures (records error_message).

   Returns: charge_run_id, units_charged, units_skipped, total_amount.';
