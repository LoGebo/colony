-- KPI Summary Tables for Analytics Dashboards
-- Uses regular tables (not materialized views) for PowerSync compatibility
-- Refreshed via pg_cron scheduled jobs

-- =============================================================================
-- TIMESTAMP TRIGGER FOR KPI TABLES
-- Simpler than set_audit_fields() since KPIs are system-computed (no created_by)
-- =============================================================================

CREATE OR REPLACE FUNCTION set_kpi_timestamps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    NEW.computed_at := now();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.computed_at := now();
    -- Preserve original created_at
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_kpi_timestamps() IS 'Trigger function for KPI tables to auto-set timestamps';

-- =============================================================================
-- KPI DAILY TABLE
-- Captures all operational metrics aggregated by day per community
-- =============================================================================

CREATE TABLE kpi_daily (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Access metrics
  total_entries INTEGER DEFAULT 0,
  resident_entries INTEGER DEFAULT 0,
  visitor_entries INTEGER DEFAULT 0,
  denied_entries INTEGER DEFAULT 0,
  entries_by_hour JSONB DEFAULT '{}'::JSONB, -- {"08": 45, "09": 67, ...}

  -- Security metrics
  incidents_reported INTEGER DEFAULT 0,
  incidents_resolved INTEGER DEFAULT 0,
  patrol_checkpoints_completed INTEGER DEFAULT 0,
  patrol_checkpoints_missed INTEGER DEFAULT 0,

  -- Financial metrics
  payments_received INTEGER DEFAULT 0,
  payments_amount money_amount DEFAULT 0,
  new_charges_count INTEGER DEFAULT 0,
  new_charges_amount money_amount DEFAULT 0,

  -- Delinquency snapshot
  units_delinquent INTEGER DEFAULT 0,
  total_delinquent_amount money_amount DEFAULT 0,

  -- Communication metrics
  announcements_sent INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,

  -- Amenity metrics
  reservations_made INTEGER DEFAULT 0,
  reservations_cancelled INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,

  -- Package metrics
  packages_received INTEGER DEFAULT 0,
  packages_picked_up INTEGER DEFAULT 0,
  packages_pending INTEGER DEFAULT 0,

  -- Maintenance metrics
  tickets_opened INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint for idempotent updates
  UNIQUE (community_id, metric_date)
);

-- Add audit trigger for timestamps
CREATE TRIGGER set_kpi_daily_audit
  BEFORE INSERT OR UPDATE ON kpi_daily
  FOR EACH ROW
  EXECUTE FUNCTION set_kpi_timestamps();

COMMENT ON TABLE kpi_daily IS 'Daily aggregated KPIs per community for dashboard display';
COMMENT ON COLUMN kpi_daily.entries_by_hour IS 'Hourly breakdown of entries: {"08": 45, "09": 67}';
COMMENT ON COLUMN kpi_daily.computed_at IS 'When this KPI row was last computed/refreshed';

-- =============================================================================
-- KPI WEEKLY TABLE
-- Aggregates daily data with trend calculations
-- =============================================================================

CREATE TABLE kpi_weekly (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- Monday of the week
  week_number INTEGER NOT NULL,
  year INTEGER NOT NULL,

  -- Aggregated metrics
  total_entries INTEGER DEFAULT 0,
  avg_daily_entries NUMERIC(10,2) DEFAULT 0,
  incidents_reported INTEGER DEFAULT 0,
  incidents_resolved INTEGER DEFAULT 0,
  payments_amount money_amount DEFAULT 0,

  -- Trend calculations (vs previous week)
  entries_change_pct NUMERIC(5,2) DEFAULT 0, -- percentage change
  incidents_change_pct NUMERIC(5,2) DEFAULT 0,
  payments_change_pct NUMERIC(5,2) DEFAULT 0,

  -- Additional weekly aggregates
  tickets_opened INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,
  packages_received INTEGER DEFAULT 0,
  packages_picked_up INTEGER DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint
  UNIQUE (community_id, year, week_number)
);

-- Add audit trigger for timestamps
CREATE TRIGGER set_kpi_weekly_audit
  BEFORE INSERT OR UPDATE ON kpi_weekly
  FOR EACH ROW
  EXECUTE FUNCTION set_kpi_timestamps();

COMMENT ON TABLE kpi_weekly IS 'Weekly aggregated KPIs with trend calculations';
COMMENT ON COLUMN kpi_weekly.week_start IS 'Monday of the ISO week';
COMMENT ON COLUMN kpi_weekly.entries_change_pct IS 'Percentage change vs previous week';

-- =============================================================================
-- KPI MONTHLY TABLE
-- Financial summaries and delinquency tracking
-- =============================================================================

CREATE TABLE kpi_monthly (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL CHECK (year >= 2020),

  -- Financial summary
  total_billed money_amount DEFAULT 0,
  total_collected money_amount DEFAULT 0,
  collection_rate NUMERIC(5,2) DEFAULT 0, -- percentage
  collection_rate_change NUMERIC(5,2) DEFAULT 0, -- vs previous month

  -- Delinquency buckets
  units_delinquent_30_days INTEGER DEFAULT 0,
  units_delinquent_60_days INTEGER DEFAULT 0,
  units_delinquent_90_days INTEGER DEFAULT 0,
  total_delinquent_amount money_amount DEFAULT 0,

  -- Access summary
  total_entries INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,

  -- Security summary
  total_incidents INTEGER DEFAULT 0,
  incidents_by_category JSONB DEFAULT '{}'::JSONB, -- {"security": 5, "noise": 3}
  avg_resolution_hours NUMERIC(10,2) DEFAULT 0,

  -- Amenity summary
  total_reservations INTEGER DEFAULT 0,
  utilization_by_amenity JSONB DEFAULT '{}'::JSONB, -- {"pool": 0.75, "gym": 0.60}

  -- Maintenance summary
  tickets_opened INTEGER DEFAULT 0,
  tickets_closed INTEGER DEFAULT 0,
  avg_ticket_resolution_hours NUMERIC(10,2) DEFAULT 0,

  -- Package summary
  packages_received INTEGER DEFAULT 0,
  packages_picked_up INTEGER DEFAULT 0,
  avg_pickup_days NUMERIC(5,2) DEFAULT 0,

  -- Metadata
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique constraint
  UNIQUE (community_id, year, month)
);

-- Add audit trigger for timestamps
CREATE TRIGGER set_kpi_monthly_audit
  BEFORE INSERT OR UPDATE ON kpi_monthly
  FOR EACH ROW
  EXECUTE FUNCTION set_kpi_timestamps();

COMMENT ON TABLE kpi_monthly IS 'Monthly financial summaries and delinquency tracking';
COMMENT ON COLUMN kpi_monthly.collection_rate IS 'Percentage of billed amount collected';
COMMENT ON COLUMN kpi_monthly.incidents_by_category IS 'Incident counts grouped by type';
COMMENT ON COLUMN kpi_monthly.utilization_by_amenity IS 'Utilization rate (0-1) by amenity';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- BRIN indexes for time-series queries (efficient for append-only data)
CREATE INDEX idx_kpi_daily_date_brin ON kpi_daily USING BRIN (metric_date);
CREATE INDEX idx_kpi_weekly_week_brin ON kpi_weekly USING BRIN (week_start);
CREATE INDEX idx_kpi_monthly_period_brin ON kpi_monthly USING BRIN (year, month);

-- B-tree indexes for community filtering with time ordering
CREATE INDEX idx_kpi_daily_community ON kpi_daily (community_id, metric_date DESC);
CREATE INDEX idx_kpi_weekly_community ON kpi_weekly (community_id, year DESC, week_number DESC);
CREATE INDEX idx_kpi_monthly_community ON kpi_monthly (community_id, year DESC, month DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE kpi_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_monthly ENABLE ROW LEVEL SECURITY;

-- Super admin policies (full access)
CREATE POLICY super_admin_kpi_daily ON kpi_daily
  FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY super_admin_kpi_weekly ON kpi_weekly
  FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY super_admin_kpi_monthly ON kpi_monthly
  FOR ALL
  USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

-- Community admin policies (view own community)
CREATE POLICY community_admin_view_kpi_daily ON kpi_daily
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('community_admin', 'manager')
  );

CREATE POLICY community_admin_view_kpi_weekly ON kpi_weekly
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('community_admin', 'manager')
  );

CREATE POLICY community_admin_view_kpi_monthly ON kpi_monthly
  FOR SELECT
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT auth.jwt() -> 'app_metadata' ->> 'role') IN ('community_admin', 'manager')
  );

-- Service role bypass for cron jobs (system-level access)
-- Note: Service role bypasses RLS, so cron jobs can compute KPIs for all communities
