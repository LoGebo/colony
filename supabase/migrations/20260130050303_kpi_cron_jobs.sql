-- KPI pg_cron Scheduled Jobs
-- Automates KPI refresh at appropriate intervals

-- =============================================================================
-- ENABLE PG_CRON EXTENSION
-- =============================================================================

-- pg_cron should be enabled in extensions schema (Supabase default)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- =============================================================================
-- SCHEDULED JOBS
-- =============================================================================

-- Daily KPI computation job
-- Runs at 1:00 AM UTC every day, computes previous day's KPIs
SELECT cron.schedule(
  'compute-daily-kpis',
  '0 1 * * *',
  $$SELECT compute_all_daily_kpis(CURRENT_DATE - 1)$$
);

-- Weekly KPI aggregation job
-- Runs at 2:00 AM UTC on Mondays, computes previous week's aggregated KPIs
SELECT cron.schedule(
  'compute-weekly-kpis',
  '0 2 * * 1',
  $$SELECT compute_all_weekly_kpis(date_trunc('week', CURRENT_DATE - 7)::DATE)$$
);

-- Monthly KPI aggregation job
-- Runs at 3:00 AM UTC on 1st of each month, computes previous month's KPIs
SELECT cron.schedule(
  'compute-monthly-kpis',
  '0 3 1 * *',
  $$SELECT compute_all_monthly_kpis(
    EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER,
    EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 month')::INTEGER
  )$$
);

-- =============================================================================
-- CRON JOB STATUS VIEW
-- =============================================================================

CREATE OR REPLACE VIEW cron_job_status AS
SELECT
  j.jobid,
  j.jobname,
  j.schedule,
  j.command,
  j.nodename,
  j.nodeport,
  j.database,
  j.username,
  j.active,
  (
    SELECT MAX(jrd.start_time)
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
  ) AS last_run,
  (
    SELECT jrd.status
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_status,
  (
    SELECT jrd.return_message
    FROM cron.job_run_details jrd
    WHERE jrd.jobid = j.jobid
    ORDER BY jrd.start_time DESC
    LIMIT 1
  ) AS last_message
FROM cron.job j
WHERE j.jobname LIKE 'compute-%';

COMMENT ON VIEW cron_job_status IS 'Monitoring view for KPI cron job execution status';

-- =============================================================================
-- HELPER FUNCTION: MANUAL KPI REFRESH
-- =============================================================================

CREATE OR REPLACE FUNCTION refresh_kpis(
  p_community_id UUID,
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (
  dates_processed INTEGER,
  weeks_processed INTEGER,
  months_processed INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_date DATE;
  v_start_date DATE := CURRENT_DATE - p_days_back;
  v_end_date DATE := CURRENT_DATE - 1;
  v_dates INTEGER := 0;
  v_weeks INTEGER := 0;
  v_months INTEGER := 0;
  v_week_start DATE;
  v_processed_weeks DATE[] := ARRAY[]::DATE[];
  v_month_year TEXT;
  v_processed_months TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Process daily KPIs
  FOR v_date IN
    SELECT generate_series(v_start_date, v_end_date, '1 day'::INTERVAL)::DATE
  LOOP
    PERFORM public.compute_daily_kpis(p_community_id, v_date);
    v_dates := v_dates + 1;

    -- Track weeks to process
    v_week_start := date_trunc('week', v_date)::DATE;
    IF NOT v_week_start = ANY(v_processed_weeks) AND v_week_start <= v_end_date - 6 THEN
      v_processed_weeks := array_append(v_processed_weeks, v_week_start);
    END IF;

    -- Track months to process
    v_month_year := to_char(v_date, 'YYYY-MM');
    IF NOT v_month_year = ANY(v_processed_months)
       AND v_date < date_trunc('month', CURRENT_DATE)::DATE THEN
      v_processed_months := array_append(v_processed_months, v_month_year);
    END IF;
  END LOOP;

  -- Process weekly KPIs for complete weeks
  FOREACH v_week_start IN ARRAY v_processed_weeks
  LOOP
    PERFORM public.compute_weekly_kpis(p_community_id, v_week_start);
    v_weeks := v_weeks + 1;
  END LOOP;

  -- Process monthly KPIs for complete months
  FOREACH v_month_year IN ARRAY v_processed_months
  LOOP
    PERFORM public.compute_monthly_kpis(
      p_community_id,
      EXTRACT(YEAR FROM (v_month_year || '-01')::DATE)::INTEGER,
      EXTRACT(MONTH FROM (v_month_year || '-01')::DATE)::INTEGER
    );
    v_months := v_months + 1;
  END LOOP;

  RETURN QUERY SELECT v_dates, v_weeks, v_months;
END;
$$;

COMMENT ON FUNCTION refresh_kpis(UUID, INTEGER) IS
  'Manually refresh KPIs for a community for the last N days.
   Also computes weekly and monthly KPIs for any complete periods.
   Usage: SELECT * FROM refresh_kpis(''community-uuid'', 30);';

-- =============================================================================
-- HELPER FUNCTION: GET PENDING KPI DATES
-- =============================================================================

CREATE OR REPLACE FUNCTION get_pending_kpi_dates(
  p_community_id UUID,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  missing_date DATE,
  has_data BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.dt AS missing_date,
    EXISTS (
      SELECT 1 FROM public.kpi_daily kd
      WHERE kd.community_id = p_community_id AND kd.metric_date = d.dt
    ) AS has_data
  FROM generate_series(
    CURRENT_DATE - p_days_back,
    CURRENT_DATE - 1,
    '1 day'::INTERVAL
  ) d(dt)
  ORDER BY d.dt DESC;
END;
$$;

COMMENT ON FUNCTION get_pending_kpi_dates(UUID, INTEGER) IS
  'Returns dates that may need KPI computation with flag indicating if data exists.
   Useful for identifying gaps in KPI data.';

-- =============================================================================
-- CLEANUP OLD JOB RUN DETAILS
-- =============================================================================

-- Job to cleanup old cron job run details (keep 30 days)
SELECT cron.schedule(
  'cleanup-cron-history',
  '0 4 * * 0',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - INTERVAL '30 days'$$
);
