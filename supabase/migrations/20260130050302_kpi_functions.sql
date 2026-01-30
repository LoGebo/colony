-- KPI Computation Functions
-- Functions to aggregate metrics from operational tables into KPI summary tables
-- Uses UPSERT pattern for idempotent execution

-- =============================================================================
-- COMPUTE DAILY KPIs
-- Aggregates metrics from all operational tables for a specific date
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_daily_kpis(
  p_community_id UUID,
  p_date DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kpi_id UUID;
  v_total_entries INTEGER := 0;
  v_resident_entries INTEGER := 0;
  v_visitor_entries INTEGER := 0;
  v_denied_entries INTEGER := 0;
  v_entries_by_hour JSONB := '{}'::JSONB;
  v_incidents_reported INTEGER := 0;
  v_incidents_resolved INTEGER := 0;
  v_patrol_completed INTEGER := 0;
  v_patrol_missed INTEGER := 0;
  v_payments_received INTEGER := 0;
  v_payments_amount NUMERIC(15,4) := 0;
  v_charges_count INTEGER := 0;
  v_charges_amount NUMERIC(15,4) := 0;
  v_units_delinquent INTEGER := 0;
  v_delinquent_amount NUMERIC(15,4) := 0;
  v_announcements_sent INTEGER := 0;
  v_messages_sent INTEGER := 0;
  v_reservations_made INTEGER := 0;
  v_reservations_cancelled INTEGER := 0;
  v_no_shows INTEGER := 0;
  v_packages_received INTEGER := 0;
  v_packages_picked_up INTEGER := 0;
  v_packages_pending INTEGER := 0;
  v_tickets_opened INTEGER := 0;
  v_tickets_closed INTEGER := 0;
BEGIN
  -- ==========================================================================
  -- ACCESS LOGS METRICS
  -- ==========================================================================

  -- Total entries and breakdown by type
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(COUNT(*) FILTER (WHERE entry_type = 'resident'), 0),
    COALESCE(COUNT(*) FILTER (WHERE entry_type = 'visitor'), 0),
    COALESCE(COUNT(*) FILTER (WHERE access_result = 'denied'), 0)
  INTO v_total_entries, v_resident_entries, v_visitor_entries, v_denied_entries
  FROM public.access_logs al
  JOIN public.access_points ap ON al.access_point_id = ap.id
  WHERE ap.community_id = p_community_id
    AND al.logged_at::DATE = p_date;

  -- Entries by hour
  SELECT COALESCE(
    jsonb_object_agg(hour_str, entry_count),
    '{}'::JSONB
  )
  INTO v_entries_by_hour
  FROM (
    SELECT
      LPAD(EXTRACT(HOUR FROM logged_at)::TEXT, 2, '0') AS hour_str,
      COUNT(*) AS entry_count
    FROM public.access_logs al
    JOIN public.access_points ap ON al.access_point_id = ap.id
    WHERE ap.community_id = p_community_id
      AND al.logged_at::DATE = p_date
      AND access_result != 'denied'
    GROUP BY EXTRACT(HOUR FROM logged_at)
  ) hourly;

  -- ==========================================================================
  -- INCIDENT METRICS
  -- ==========================================================================

  SELECT
    COALESCE(COUNT(*) FILTER (WHERE reported_at::DATE = p_date), 0),
    COALESCE(COUNT(*) FILTER (WHERE resolved_at::DATE = p_date), 0)
  INTO v_incidents_reported, v_incidents_resolved
  FROM public.incidents
  WHERE community_id = p_community_id
    AND (reported_at::DATE = p_date OR resolved_at::DATE = p_date);

  -- ==========================================================================
  -- PATROL METRICS
  -- ==========================================================================

  -- Check if patrol_logs table exists and aggregate
  BEGIN
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE scanned_at IS NOT NULL), 0),
      COALESCE(COUNT(*) FILTER (WHERE scanned_at IS NULL AND expected_at < now()), 0)
    INTO v_patrol_completed, v_patrol_missed
    FROM public.patrol_checkpoint_logs pcl
    JOIN public.patrol_logs pl ON pcl.patrol_log_id = pl.id
    WHERE pl.community_id = p_community_id
      AND pl.started_at::DATE = p_date;
  EXCEPTION
    WHEN undefined_table THEN
      v_patrol_completed := 0;
      v_patrol_missed := 0;
  END;

  -- ==========================================================================
  -- FINANCIAL METRICS
  -- ==========================================================================

  -- Payments received (posted transactions of type payment)
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(amount), 0)
  INTO v_payments_received, v_payments_amount
  FROM public.transactions
  WHERE community_id = p_community_id
    AND transaction_type = 'payment'
    AND status = 'posted'
    AND posted_at::DATE = p_date;

  -- Charges created
  SELECT
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(amount), 0)
  INTO v_charges_count, v_charges_amount
  FROM public.transactions
  WHERE community_id = p_community_id
    AND transaction_type = 'charge'
    AND status = 'posted'
    AND posted_at::DATE = p_date;

  -- Delinquency snapshot (units with balance > 0)
  BEGIN
    SELECT
      COALESCE(COUNT(*), 0),
      COALESCE(SUM(current_balance), 0)
    INTO v_units_delinquent, v_delinquent_amount
    FROM public.unit_balances
    WHERE community_id = p_community_id
      AND current_balance > 0;
  EXCEPTION
    WHEN undefined_table THEN
      v_units_delinquent := 0;
      v_delinquent_amount := 0;
  END;

  -- ==========================================================================
  -- COMMUNICATION METRICS
  -- ==========================================================================

  -- Announcements sent
  BEGIN
    SELECT COALESCE(COUNT(*), 0)
    INTO v_announcements_sent
    FROM public.announcements
    WHERE community_id = p_community_id
      AND published_at::DATE = p_date;
  EXCEPTION
    WHEN undefined_table THEN
      v_announcements_sent := 0;
  END;

  -- Messages sent
  BEGIN
    SELECT COALESCE(COUNT(*), 0)
    INTO v_messages_sent
    FROM public.messages m
    JOIN public.conversations c ON m.conversation_id = c.id
    WHERE c.community_id = p_community_id
      AND m.created_at::DATE = p_date;
  EXCEPTION
    WHEN undefined_table THEN
      v_messages_sent := 0;
  END;

  -- ==========================================================================
  -- AMENITY METRICS
  -- ==========================================================================

  BEGIN
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE created_at::DATE = p_date), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at::DATE = p_date), 0),
      COALESCE(COUNT(*) FILTER (WHERE status = 'no_show' AND updated_at::DATE = p_date), 0)
    INTO v_reservations_made, v_reservations_cancelled, v_no_shows
    FROM public.reservations r
    JOIN public.amenities a ON r.amenity_id = a.id
    WHERE a.community_id = p_community_id
      AND (r.created_at::DATE = p_date OR r.updated_at::DATE = p_date);
  EXCEPTION
    WHEN undefined_table THEN
      v_reservations_made := 0;
      v_reservations_cancelled := 0;
      v_no_shows := 0;
  END;

  -- ==========================================================================
  -- PACKAGE METRICS
  -- ==========================================================================

  BEGIN
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE received_at::DATE = p_date), 0),
      COALESCE(COUNT(*) FILTER (WHERE picked_up_at::DATE = p_date), 0),
      COALESCE(COUNT(*) FILTER (WHERE status IN ('received', 'stored', 'notified', 'pending_pickup')), 0)
    INTO v_packages_received, v_packages_picked_up, v_packages_pending
    FROM public.packages
    WHERE community_id = p_community_id
      AND (received_at::DATE = p_date OR picked_up_at::DATE = p_date OR status IN ('received', 'stored', 'notified', 'pending_pickup'));
  EXCEPTION
    WHEN undefined_table THEN
      v_packages_received := 0;
      v_packages_picked_up := 0;
      v_packages_pending := 0;
  END;

  -- ==========================================================================
  -- MAINTENANCE METRICS
  -- ==========================================================================

  BEGIN
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE created_at::DATE = p_date), 0),
      COALESCE(COUNT(*) FILTER (WHERE status IN ('resolved', 'closed') AND status_changed_at::DATE = p_date), 0)
    INTO v_tickets_opened, v_tickets_closed
    FROM public.tickets
    WHERE community_id = p_community_id
      AND (created_at::DATE = p_date OR status_changed_at::DATE = p_date);
  EXCEPTION
    WHEN undefined_table THEN
      v_tickets_opened := 0;
      v_tickets_closed := 0;
  END;

  -- ==========================================================================
  -- UPSERT KPI RECORD
  -- ==========================================================================

  INSERT INTO public.kpi_daily (
    community_id,
    metric_date,
    total_entries,
    resident_entries,
    visitor_entries,
    denied_entries,
    entries_by_hour,
    incidents_reported,
    incidents_resolved,
    patrol_checkpoints_completed,
    patrol_checkpoints_missed,
    payments_received,
    payments_amount,
    new_charges_count,
    new_charges_amount,
    units_delinquent,
    total_delinquent_amount,
    announcements_sent,
    messages_sent,
    reservations_made,
    reservations_cancelled,
    no_shows,
    packages_received,
    packages_picked_up,
    packages_pending,
    tickets_opened,
    tickets_closed,
    computed_at
  )
  VALUES (
    p_community_id,
    p_date,
    v_total_entries,
    v_resident_entries,
    v_visitor_entries,
    v_denied_entries,
    v_entries_by_hour,
    v_incidents_reported,
    v_incidents_resolved,
    v_patrol_completed,
    v_patrol_missed,
    v_payments_received,
    v_payments_amount,
    v_charges_count,
    v_charges_amount,
    v_units_delinquent,
    v_delinquent_amount,
    v_announcements_sent,
    v_messages_sent,
    v_reservations_made,
    v_reservations_cancelled,
    v_no_shows,
    v_packages_received,
    v_packages_picked_up,
    v_packages_pending,
    v_tickets_opened,
    v_tickets_closed,
    now()
  )
  ON CONFLICT (community_id, metric_date)
  DO UPDATE SET
    total_entries = EXCLUDED.total_entries,
    resident_entries = EXCLUDED.resident_entries,
    visitor_entries = EXCLUDED.visitor_entries,
    denied_entries = EXCLUDED.denied_entries,
    entries_by_hour = EXCLUDED.entries_by_hour,
    incidents_reported = EXCLUDED.incidents_reported,
    incidents_resolved = EXCLUDED.incidents_resolved,
    patrol_checkpoints_completed = EXCLUDED.patrol_checkpoints_completed,
    patrol_checkpoints_missed = EXCLUDED.patrol_checkpoints_missed,
    payments_received = EXCLUDED.payments_received,
    payments_amount = EXCLUDED.payments_amount,
    new_charges_count = EXCLUDED.new_charges_count,
    new_charges_amount = EXCLUDED.new_charges_amount,
    units_delinquent = EXCLUDED.units_delinquent,
    total_delinquent_amount = EXCLUDED.total_delinquent_amount,
    announcements_sent = EXCLUDED.announcements_sent,
    messages_sent = EXCLUDED.messages_sent,
    reservations_made = EXCLUDED.reservations_made,
    reservations_cancelled = EXCLUDED.reservations_cancelled,
    no_shows = EXCLUDED.no_shows,
    packages_received = EXCLUDED.packages_received,
    packages_picked_up = EXCLUDED.packages_picked_up,
    packages_pending = EXCLUDED.packages_pending,
    tickets_opened = EXCLUDED.tickets_opened,
    tickets_closed = EXCLUDED.tickets_closed,
    computed_at = EXCLUDED.computed_at
  RETURNING id INTO v_kpi_id;

  RETURN v_kpi_id;
END;
$$;

COMMENT ON FUNCTION compute_daily_kpis(UUID, DATE) IS
  'Computes daily KPIs for a community by aggregating from operational tables.
   Uses UPSERT for idempotent execution - safe to run multiple times.';

-- =============================================================================
-- COMPUTE WEEKLY KPIs
-- Aggregates from kpi_daily with trend calculations
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_weekly_kpis(
  p_community_id UUID,
  p_week_start DATE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kpi_id UUID;
  v_week_end DATE := p_week_start + INTERVAL '6 days';
  v_prev_week_start DATE := p_week_start - INTERVAL '7 days';
  v_prev_week_end DATE := p_week_start - INTERVAL '1 day';
  v_week_number INTEGER;
  v_year INTEGER;

  -- Current week metrics
  v_total_entries INTEGER := 0;
  v_avg_daily_entries NUMERIC(10,2) := 0;
  v_incidents_reported INTEGER := 0;
  v_incidents_resolved INTEGER := 0;
  v_payments_amount NUMERIC(15,4) := 0;
  v_tickets_opened INTEGER := 0;
  v_tickets_closed INTEGER := 0;
  v_packages_received INTEGER := 0;
  v_packages_picked_up INTEGER := 0;

  -- Previous week metrics for trend calculation
  v_prev_entries INTEGER := 0;
  v_prev_incidents INTEGER := 0;
  v_prev_payments NUMERIC(15,4) := 0;

  -- Trend percentages
  v_entries_change NUMERIC(5,2) := 0;
  v_incidents_change NUMERIC(5,2) := 0;
  v_payments_change NUMERIC(5,2) := 0;
BEGIN
  -- Get ISO week number and year
  v_week_number := EXTRACT(WEEK FROM p_week_start)::INTEGER;
  v_year := EXTRACT(YEAR FROM p_week_start)::INTEGER;

  -- Aggregate current week from kpi_daily
  SELECT
    COALESCE(SUM(total_entries), 0),
    COALESCE(AVG(total_entries), 0),
    COALESCE(SUM(incidents_reported), 0),
    COALESCE(SUM(incidents_resolved), 0),
    COALESCE(SUM(payments_amount), 0),
    COALESCE(SUM(tickets_opened), 0),
    COALESCE(SUM(tickets_closed), 0),
    COALESCE(SUM(packages_received), 0),
    COALESCE(SUM(packages_picked_up), 0)
  INTO
    v_total_entries,
    v_avg_daily_entries,
    v_incidents_reported,
    v_incidents_resolved,
    v_payments_amount,
    v_tickets_opened,
    v_tickets_closed,
    v_packages_received,
    v_packages_picked_up
  FROM public.kpi_daily
  WHERE community_id = p_community_id
    AND metric_date BETWEEN p_week_start AND v_week_end;

  -- Get previous week totals for trend calculation
  SELECT
    COALESCE(SUM(total_entries), 0),
    COALESCE(SUM(incidents_reported), 0),
    COALESCE(SUM(payments_amount), 0)
  INTO v_prev_entries, v_prev_incidents, v_prev_payments
  FROM public.kpi_daily
  WHERE community_id = p_community_id
    AND metric_date BETWEEN v_prev_week_start AND v_prev_week_end;

  -- Calculate percentage changes
  IF v_prev_entries > 0 THEN
    v_entries_change := ROUND(((v_total_entries::NUMERIC - v_prev_entries) / v_prev_entries) * 100, 2);
  END IF;

  IF v_prev_incidents > 0 THEN
    v_incidents_change := ROUND(((v_incidents_reported::NUMERIC - v_prev_incidents) / v_prev_incidents) * 100, 2);
  END IF;

  IF v_prev_payments > 0 THEN
    v_payments_change := ROUND(((v_payments_amount - v_prev_payments) / v_prev_payments) * 100, 2);
  END IF;

  -- UPSERT weekly KPI
  INSERT INTO public.kpi_weekly (
    community_id,
    week_start,
    week_number,
    year,
    total_entries,
    avg_daily_entries,
    incidents_reported,
    incidents_resolved,
    payments_amount,
    entries_change_pct,
    incidents_change_pct,
    payments_change_pct,
    tickets_opened,
    tickets_closed,
    packages_received,
    packages_picked_up,
    computed_at
  )
  VALUES (
    p_community_id,
    p_week_start,
    v_week_number,
    v_year,
    v_total_entries,
    v_avg_daily_entries,
    v_incidents_reported,
    v_incidents_resolved,
    v_payments_amount,
    v_entries_change,
    v_incidents_change,
    v_payments_change,
    v_tickets_opened,
    v_tickets_closed,
    v_packages_received,
    v_packages_picked_up,
    now()
  )
  ON CONFLICT (community_id, year, week_number)
  DO UPDATE SET
    week_start = EXCLUDED.week_start,
    total_entries = EXCLUDED.total_entries,
    avg_daily_entries = EXCLUDED.avg_daily_entries,
    incidents_reported = EXCLUDED.incidents_reported,
    incidents_resolved = EXCLUDED.incidents_resolved,
    payments_amount = EXCLUDED.payments_amount,
    entries_change_pct = EXCLUDED.entries_change_pct,
    incidents_change_pct = EXCLUDED.incidents_change_pct,
    payments_change_pct = EXCLUDED.payments_change_pct,
    tickets_opened = EXCLUDED.tickets_opened,
    tickets_closed = EXCLUDED.tickets_closed,
    packages_received = EXCLUDED.packages_received,
    packages_picked_up = EXCLUDED.packages_picked_up,
    computed_at = EXCLUDED.computed_at
  RETURNING id INTO v_kpi_id;

  RETURN v_kpi_id;
END;
$$;

COMMENT ON FUNCTION compute_weekly_kpis(UUID, DATE) IS
  'Computes weekly KPIs by aggregating from kpi_daily with trend calculations.
   p_week_start should be a Monday (ISO week start).';

-- =============================================================================
-- COMPUTE MONTHLY KPIs
-- Financial summaries and delinquency tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_monthly_kpis(
  p_community_id UUID,
  p_year INTEGER,
  p_month INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kpi_id UUID;
  v_month_start DATE := make_date(p_year, p_month, 1);
  v_month_end DATE := (v_month_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_prev_month_start DATE := v_month_start - INTERVAL '1 month';
  v_prev_month_end DATE := v_month_start - INTERVAL '1 day';
  v_today DATE := CURRENT_DATE;

  -- Financial metrics
  v_total_billed NUMERIC(15,4) := 0;
  v_total_collected NUMERIC(15,4) := 0;
  v_collection_rate NUMERIC(5,2) := 0;
  v_prev_collection_rate NUMERIC(5,2) := 0;
  v_collection_rate_change NUMERIC(5,2) := 0;

  -- Delinquency buckets
  v_delinquent_30 INTEGER := 0;
  v_delinquent_60 INTEGER := 0;
  v_delinquent_90 INTEGER := 0;
  v_delinquent_total NUMERIC(15,4) := 0;

  -- Access metrics
  v_total_entries INTEGER := 0;
  v_unique_visitors INTEGER := 0;

  -- Incident metrics
  v_total_incidents INTEGER := 0;
  v_incidents_by_category JSONB := '{}'::JSONB;
  v_avg_resolution_hours NUMERIC(10,2) := 0;

  -- Amenity metrics
  v_total_reservations INTEGER := 0;
  v_utilization_by_amenity JSONB := '{}'::JSONB;

  -- Maintenance metrics
  v_tickets_opened INTEGER := 0;
  v_tickets_closed INTEGER := 0;
  v_avg_ticket_resolution NUMERIC(10,2) := 0;

  -- Package metrics
  v_packages_received INTEGER := 0;
  v_packages_picked_up INTEGER := 0;
  v_avg_pickup_days NUMERIC(5,2) := 0;
BEGIN
  -- ==========================================================================
  -- AGGREGATE FROM KPI_DAILY
  -- ==========================================================================

  SELECT
    COALESCE(SUM(total_entries), 0),
    COALESCE(SUM(incidents_reported), 0),
    COALESCE(SUM(tickets_opened), 0),
    COALESCE(SUM(tickets_closed), 0),
    COALESCE(SUM(packages_received), 0),
    COALESCE(SUM(packages_picked_up), 0),
    COALESCE(SUM(reservations_made), 0)
  INTO
    v_total_entries,
    v_total_incidents,
    v_tickets_opened,
    v_tickets_closed,
    v_packages_received,
    v_packages_picked_up,
    v_total_reservations
  FROM public.kpi_daily
  WHERE community_id = p_community_id
    AND metric_date BETWEEN v_month_start AND v_month_end;

  -- ==========================================================================
  -- FINANCIAL METRICS (from transactions)
  -- ==========================================================================

  -- Total billed (charges in the month)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_billed
  FROM public.transactions
  WHERE community_id = p_community_id
    AND transaction_type = 'charge'
    AND status = 'posted'
    AND posted_at::DATE BETWEEN v_month_start AND v_month_end;

  -- Total collected (payments in the month)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_collected
  FROM public.transactions
  WHERE community_id = p_community_id
    AND transaction_type = 'payment'
    AND status = 'posted'
    AND posted_at::DATE BETWEEN v_month_start AND v_month_end;

  -- Collection rate
  IF v_total_billed > 0 THEN
    v_collection_rate := ROUND((v_total_collected / v_total_billed) * 100, 2);
  END IF;

  -- Previous month collection rate for trend
  DECLARE
    v_prev_billed NUMERIC(15,4);
    v_prev_collected NUMERIC(15,4);
  BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO v_prev_billed
    FROM public.transactions
    WHERE community_id = p_community_id
      AND transaction_type = 'charge'
      AND status = 'posted'
      AND posted_at::DATE BETWEEN v_prev_month_start AND v_prev_month_end;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_prev_collected
    FROM public.transactions
    WHERE community_id = p_community_id
      AND transaction_type = 'payment'
      AND status = 'posted'
      AND posted_at::DATE BETWEEN v_prev_month_start AND v_prev_month_end;

    IF v_prev_billed > 0 THEN
      v_prev_collection_rate := ROUND((v_prev_collected / v_prev_billed) * 100, 2);
    END IF;
  END;

  v_collection_rate_change := v_collection_rate - v_prev_collection_rate;

  -- ==========================================================================
  -- DELINQUENCY BUCKETS (from unit_balances view)
  -- ==========================================================================

  BEGIN
    SELECT
      COALESCE(COUNT(*) FILTER (WHERE oldest_charge_date <= v_today - INTERVAL '30 days' AND oldest_charge_date > v_today - INTERVAL '60 days'), 0),
      COALESCE(COUNT(*) FILTER (WHERE oldest_charge_date <= v_today - INTERVAL '60 days' AND oldest_charge_date > v_today - INTERVAL '90 days'), 0),
      COALESCE(COUNT(*) FILTER (WHERE oldest_charge_date <= v_today - INTERVAL '90 days'), 0),
      COALESCE(SUM(current_balance), 0)
    INTO v_delinquent_30, v_delinquent_60, v_delinquent_90, v_delinquent_total
    FROM public.unit_balances
    WHERE community_id = p_community_id
      AND current_balance > 0;
  EXCEPTION
    WHEN undefined_table OR undefined_column THEN
      -- unit_balances may not have oldest_charge_date
      SELECT
        COALESCE(COUNT(*), 0),
        COALESCE(SUM(current_balance), 0)
      INTO v_delinquent_30, v_delinquent_total
      FROM public.unit_balances
      WHERE community_id = p_community_id
        AND current_balance > 0;
      v_delinquent_60 := 0;
      v_delinquent_90 := 0;
  END;

  -- ==========================================================================
  -- UNIQUE VISITORS
  -- ==========================================================================

  BEGIN
    SELECT COALESCE(COUNT(DISTINCT person_name), 0)
    INTO v_unique_visitors
    FROM public.access_logs al
    JOIN public.access_points ap ON al.access_point_id = ap.id
    WHERE ap.community_id = p_community_id
      AND al.logged_at::DATE BETWEEN v_month_start AND v_month_end
      AND al.entry_type = 'visitor';
  EXCEPTION
    WHEN undefined_table THEN
      v_unique_visitors := 0;
  END;

  -- ==========================================================================
  -- INCIDENT BREAKDOWN BY CATEGORY
  -- ==========================================================================

  BEGIN
    SELECT COALESCE(
      jsonb_object_agg(category, incident_count),
      '{}'::JSONB
    )
    INTO v_incidents_by_category
    FROM (
      SELECT
        it.category::TEXT,
        COUNT(*) AS incident_count
      FROM public.incidents i
      JOIN public.incident_types it ON i.incident_type_id = it.id
      WHERE i.community_id = p_community_id
        AND i.reported_at::DATE BETWEEN v_month_start AND v_month_end
      GROUP BY it.category
    ) categories;

    -- Average resolution time
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)) / 3600),
      0
    )
    INTO v_avg_resolution_hours
    FROM public.incidents
    WHERE community_id = p_community_id
      AND resolved_at IS NOT NULL
      AND reported_at::DATE BETWEEN v_month_start AND v_month_end;
  EXCEPTION
    WHEN undefined_table THEN
      v_incidents_by_category := '{}'::JSONB;
      v_avg_resolution_hours := 0;
  END;

  -- ==========================================================================
  -- AMENITY UTILIZATION
  -- ==========================================================================

  BEGIN
    SELECT COALESCE(
      jsonb_object_agg(amenity_name, utilization_rate),
      '{}'::JSONB
    )
    INTO v_utilization_by_amenity
    FROM (
      SELECT
        a.name AS amenity_name,
        ROUND(
          COUNT(*) FILTER (WHERE r.status = 'completed')::NUMERIC /
          NULLIF(COUNT(*), 0),
          2
        ) AS utilization_rate
      FROM public.reservations r
      JOIN public.amenities a ON r.amenity_id = a.id
      WHERE a.community_id = p_community_id
        AND r.created_at::DATE BETWEEN v_month_start AND v_month_end
      GROUP BY a.name
    ) amenities;
  EXCEPTION
    WHEN undefined_table THEN
      v_utilization_by_amenity := '{}'::JSONB;
  END;

  -- ==========================================================================
  -- MAINTENANCE RESOLUTION TIME
  -- ==========================================================================

  BEGIN
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600),
      0
    )
    INTO v_avg_ticket_resolution
    FROM public.tickets
    WHERE community_id = p_community_id
      AND status IN ('resolved', 'closed')
      AND resolved_at IS NOT NULL
      AND created_at::DATE BETWEEN v_month_start AND v_month_end;
  EXCEPTION
    WHEN undefined_table THEN
      v_avg_ticket_resolution := 0;
  END;

  -- ==========================================================================
  -- PACKAGE PICKUP TIME
  -- ==========================================================================

  BEGIN
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (picked_up_at - received_at)) / 86400),
      0
    )
    INTO v_avg_pickup_days
    FROM public.packages
    WHERE community_id = p_community_id
      AND picked_up_at IS NOT NULL
      AND received_at::DATE BETWEEN v_month_start AND v_month_end;
  EXCEPTION
    WHEN undefined_table THEN
      v_avg_pickup_days := 0;
  END;

  -- ==========================================================================
  -- UPSERT MONTHLY KPI
  -- ==========================================================================

  INSERT INTO public.kpi_monthly (
    community_id,
    month,
    year,
    total_billed,
    total_collected,
    collection_rate,
    collection_rate_change,
    units_delinquent_30_days,
    units_delinquent_60_days,
    units_delinquent_90_days,
    total_delinquent_amount,
    total_entries,
    unique_visitors,
    total_incidents,
    incidents_by_category,
    avg_resolution_hours,
    total_reservations,
    utilization_by_amenity,
    tickets_opened,
    tickets_closed,
    avg_ticket_resolution_hours,
    packages_received,
    packages_picked_up,
    avg_pickup_days,
    computed_at
  )
  VALUES (
    p_community_id,
    p_month,
    p_year,
    v_total_billed,
    v_total_collected,
    v_collection_rate,
    v_collection_rate_change,
    v_delinquent_30,
    v_delinquent_60,
    v_delinquent_90,
    v_delinquent_total,
    v_total_entries,
    v_unique_visitors,
    v_total_incidents,
    v_incidents_by_category,
    v_avg_resolution_hours,
    v_total_reservations,
    v_utilization_by_amenity,
    v_tickets_opened,
    v_tickets_closed,
    v_avg_ticket_resolution,
    v_packages_received,
    v_packages_picked_up,
    v_avg_pickup_days,
    now()
  )
  ON CONFLICT (community_id, year, month)
  DO UPDATE SET
    total_billed = EXCLUDED.total_billed,
    total_collected = EXCLUDED.total_collected,
    collection_rate = EXCLUDED.collection_rate,
    collection_rate_change = EXCLUDED.collection_rate_change,
    units_delinquent_30_days = EXCLUDED.units_delinquent_30_days,
    units_delinquent_60_days = EXCLUDED.units_delinquent_60_days,
    units_delinquent_90_days = EXCLUDED.units_delinquent_90_days,
    total_delinquent_amount = EXCLUDED.total_delinquent_amount,
    total_entries = EXCLUDED.total_entries,
    unique_visitors = EXCLUDED.unique_visitors,
    total_incidents = EXCLUDED.total_incidents,
    incidents_by_category = EXCLUDED.incidents_by_category,
    avg_resolution_hours = EXCLUDED.avg_resolution_hours,
    total_reservations = EXCLUDED.total_reservations,
    utilization_by_amenity = EXCLUDED.utilization_by_amenity,
    tickets_opened = EXCLUDED.tickets_opened,
    tickets_closed = EXCLUDED.tickets_closed,
    avg_ticket_resolution_hours = EXCLUDED.avg_ticket_resolution_hours,
    packages_received = EXCLUDED.packages_received,
    packages_picked_up = EXCLUDED.packages_picked_up,
    avg_pickup_days = EXCLUDED.avg_pickup_days,
    computed_at = EXCLUDED.computed_at
  RETURNING id INTO v_kpi_id;

  RETURN v_kpi_id;
END;
$$;

COMMENT ON FUNCTION compute_monthly_kpis(UUID, INTEGER, INTEGER) IS
  'Computes monthly KPIs with financial summaries and delinquency tracking.
   Aggregates from kpi_daily and source tables for detailed metrics.';

-- =============================================================================
-- COMPUTE ALL COMMUNITIES (for cron jobs)
-- =============================================================================

CREATE OR REPLACE FUNCTION compute_all_daily_kpis(p_date DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_community IN
    SELECT id FROM public.communities WHERE deleted_at IS NULL
  LOOP
    PERFORM public.compute_daily_kpis(v_community.id, p_date);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_all_daily_kpis(DATE) IS
  'Computes daily KPIs for all active communities. Called by pg_cron job.';

CREATE OR REPLACE FUNCTION compute_all_weekly_kpis(p_week_start DATE)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_community IN
    SELECT id FROM public.communities WHERE deleted_at IS NULL
  LOOP
    PERFORM public.compute_weekly_kpis(v_community.id, p_week_start);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_all_weekly_kpis(DATE) IS
  'Computes weekly KPIs for all active communities. Called by pg_cron job.';

CREATE OR REPLACE FUNCTION compute_all_monthly_kpis(p_year INTEGER, p_month INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_community RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_community IN
    SELECT id FROM public.communities WHERE deleted_at IS NULL
  LOOP
    PERFORM public.compute_monthly_kpis(v_community.id, p_year, p_month);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION compute_all_monthly_kpis(INTEGER, INTEGER) IS
  'Computes monthly KPIs for all active communities. Called by pg_cron job.';

-- =============================================================================
-- BACKFILL FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION backfill_kpis(
  p_community_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date DATE;
  v_count INTEGER := 0;
BEGIN
  -- Backfill daily KPIs
  FOR v_date IN
    SELECT generate_series(p_start_date, p_end_date, '1 day'::INTERVAL)::DATE
  LOOP
    PERFORM public.compute_daily_kpis(p_community_id, v_date);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION backfill_kpis(UUID, DATE, DATE) IS
  'Backfills daily KPIs for a date range. Useful for new communities or data corrections.';
