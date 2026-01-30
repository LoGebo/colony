-- Migration: audit_log_table
-- Phase: 07-operations-compliance
-- Plan: 04 (Audit Logs & Compliance)
-- Task: 2 - Create audit_log table with immutability and tracking functions
-- Description: Immutable audit log with trigger-based before/after capture
-- Patterns: Follows Phase 4 ledger_entries immutability pattern

-- ============================================================================
-- AUDIT_LOG TABLE
-- ============================================================================
-- Core audit log table capturing all tracked database operations
-- IMPORTANT: This table is APPEND-ONLY. No updates or deletes allowed.

CREATE TABLE IF NOT EXISTS audit.audit_log (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),

  -- What changed (table identification)
  table_schema TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  table_oid OID NOT NULL,

  -- Record identification
  record_id UUID,                         -- Primary key if UUID type
  record_pk JSONB,                        -- For composite keys or non-UUID PKs

  -- Operation type
  operation audit.operation NOT NULL,

  -- Data (JSONB for flexibility)
  old_record JSONB,                       -- NULL for INSERT
  new_record JSONB,                       -- NULL for DELETE
  changed_fields TEXT[],                  -- List of changed column names (UPDATE only)

  -- Actor information
  actor_id UUID,                          -- auth.uid() if available
  actor_role TEXT,                        -- Database role (postgres, authenticator, etc.)
  actor_ip INET,                          -- Client IP address
  actor_user_agent TEXT,                  -- User agent from request headers

  -- Context
  community_id UUID,                      -- Extracted from record if present (for tenant queries)

  -- Timestamp
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Transaction info
  transaction_id BIGINT DEFAULT txid_current()
);

-- Comments
COMMENT ON TABLE audit.audit_log IS 'Immutable audit log capturing all tracked operations. APPEND-ONLY - no updates or deletes allowed.';
COMMENT ON COLUMN audit.audit_log.record_pk IS 'JSONB representation of primary key(s) for composite or non-UUID PKs';
COMMENT ON COLUMN audit.audit_log.changed_fields IS 'Array of column names that changed (UPDATE operations only)';
COMMENT ON COLUMN audit.audit_log.community_id IS 'Extracted from record for tenant-scoped audit queries';
COMMENT ON COLUMN audit.audit_log.transaction_id IS 'PostgreSQL transaction ID for correlating related changes';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- BRIN index for time-series queries (efficient for append-only, time-ordered data)
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp_brin
  ON audit.audit_log USING BRIN (logged_at) WITH (pages_per_range = 32);

-- B-tree indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_audit_log_table
  ON audit.audit_log (table_name, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record
  ON audit.audit_log (record_id, logged_at DESC)
  WHERE record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON audit.audit_log (actor_id, logged_at DESC)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_community
  ON audit.audit_log (community_id, logged_at DESC)
  WHERE community_id IS NOT NULL;

-- ============================================================================
-- IMMUTABILITY TRIGGER
-- ============================================================================
-- Prevents any modification to audit records after insertion
-- Pattern: Same as access_logs and ledger_entries immutability

CREATE OR REPLACE FUNCTION audit.prevent_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit.audit_log is append-only: % operations are not allowed', TG_OP
    USING HINT = 'Audit records cannot be modified or deleted for compliance purposes';
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION audit.prevent_audit_modification() IS 'Trigger function that prevents UPDATE/DELETE on audit_log (immutability enforcement)';

-- Trigger to prevent updates
CREATE TRIGGER audit_log_prevent_update
  BEFORE UPDATE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_audit_modification();

-- Trigger to prevent deletes
CREATE TRIGGER audit_log_prevent_delete
  BEFORE DELETE ON audit.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit.prevent_audit_modification();

-- ============================================================================
-- LOG_CHANGES TRIGGER FUNCTION
-- ============================================================================
-- Called by audit triggers on tracked tables to capture changes

CREATE OR REPLACE FUNCTION audit.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id UUID;
  v_actor_ip INET;
  v_actor_user_agent TEXT;
  v_old_record JSONB;
  v_new_record JSONB;
  v_changed_fields TEXT[];
  v_record_id UUID;
  v_community_id UUID;
  v_col TEXT;
BEGIN
  -- Extract actor information from auth context (with exception handling)
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  -- Try to get IP and user_agent from request headers (Supabase specific)
  BEGIN
    v_actor_ip := (current_setting('request.headers', TRUE)::JSON->>'x-forwarded-for')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_actor_ip := NULL;
  END;

  BEGIN
    v_actor_user_agent := current_setting('request.headers', TRUE)::JSON->>'user-agent';
  EXCEPTION WHEN OTHERS THEN
    v_actor_user_agent := NULL;
  END;

  -- Handle based on operation type
  IF TG_OP = 'INSERT' THEN
    v_new_record := to_jsonb(NEW);
    v_old_record := NULL;
    v_changed_fields := NULL;

    -- Extract record_id if record has 'id' field
    IF v_new_record ? 'id' THEN
      BEGIN
        v_record_id := (v_new_record->>'id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_record_id := NULL;
      END;
    END IF;

    -- Extract community_id if record has 'community_id' field
    IF v_new_record ? 'community_id' THEN
      BEGIN
        v_community_id := (v_new_record->>'community_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_community_id := NULL;
      END;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    v_old_record := to_jsonb(OLD);
    v_new_record := to_jsonb(NEW);

    -- Compute changed fields array
    v_changed_fields := ARRAY[]::TEXT[];
    FOR v_col IN SELECT key FROM jsonb_each(v_new_record) LOOP
      IF v_old_record->v_col IS DISTINCT FROM v_new_record->v_col THEN
        v_changed_fields := v_changed_fields || v_col;
      END IF;
    END LOOP;

    -- Extract record_id
    IF v_new_record ? 'id' THEN
      BEGIN
        v_record_id := (v_new_record->>'id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_record_id := NULL;
      END;
    END IF;

    -- Extract community_id
    IF v_new_record ? 'community_id' THEN
      BEGIN
        v_community_id := (v_new_record->>'community_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_community_id := NULL;
      END;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_old_record := to_jsonb(OLD);
    v_new_record := NULL;
    v_changed_fields := NULL;

    -- Extract record_id from old record
    IF v_old_record ? 'id' THEN
      BEGIN
        v_record_id := (v_old_record->>'id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_record_id := NULL;
      END;
    END IF;

    -- Extract community_id from old record
    IF v_old_record ? 'community_id' THEN
      BEGIN
        v_community_id := (v_old_record->>'community_id')::UUID;
      EXCEPTION WHEN OTHERS THEN
        v_community_id := NULL;
      END;
    END IF;
  END IF;

  -- Insert audit record
  INSERT INTO audit.audit_log (
    table_schema,
    table_name,
    table_oid,
    record_id,
    operation,
    old_record,
    new_record,
    changed_fields,
    actor_id,
    actor_role,
    actor_ip,
    actor_user_agent,
    community_id
  ) VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_RELID,
    v_record_id,
    TG_OP::audit.operation,
    v_old_record,
    v_new_record,
    v_changed_fields,
    v_actor_id,
    current_user,
    v_actor_ip,
    v_actor_user_agent,
    v_community_id
  );

  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION audit.log_changes() IS 'Trigger function that captures INSERT/UPDATE/DELETE operations into audit.audit_log';

-- ============================================================================
-- ENABLE_TRACKING FUNCTION
-- ============================================================================
-- Dynamically adds audit trigger to target table

CREATE OR REPLACE FUNCTION audit.enable_tracking(target_table REGCLASS)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name TEXT;
  v_trigger_name TEXT;
BEGIN
  -- Extract table name from regclass
  v_table_name := target_table::TEXT;

  -- Remove schema prefix if present for trigger name
  IF v_table_name LIKE '%.%' THEN
    v_trigger_name := 'audit_' || split_part(v_table_name, '.', 2);
  ELSE
    v_trigger_name := 'audit_' || v_table_name;
  END IF;

  -- Create the audit trigger
  EXECUTE format(
    'CREATE TRIGGER %I
     AFTER INSERT OR UPDATE OR DELETE ON %s
     FOR EACH ROW
     EXECUTE FUNCTION audit.log_changes()',
    v_trigger_name,
    target_table
  );

  RAISE NOTICE 'Audit tracking enabled for table: %', target_table;
END;
$$;

COMMENT ON FUNCTION audit.enable_tracking(REGCLASS) IS 'Enables audit logging on a table by creating an audit trigger';

-- ============================================================================
-- DISABLE_TRACKING FUNCTION
-- ============================================================================
-- Removes audit trigger from target table

CREATE OR REPLACE FUNCTION audit.disable_tracking(target_table REGCLASS)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_name TEXT;
  v_trigger_name TEXT;
BEGIN
  -- Extract table name from regclass
  v_table_name := target_table::TEXT;

  -- Remove schema prefix if present for trigger name
  IF v_table_name LIKE '%.%' THEN
    v_trigger_name := 'audit_' || split_part(v_table_name, '.', 2);
  ELSE
    v_trigger_name := 'audit_' || v_table_name;
  END IF;

  -- Drop the audit trigger
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %s',
    v_trigger_name,
    target_table
  );

  RAISE NOTICE 'Audit tracking disabled for table: %', target_table;
END;
$$;

COMMENT ON FUNCTION audit.disable_tracking(REGCLASS) IS 'Disables audit logging on a table by removing the audit trigger';

-- ============================================================================
-- ENABLE AUDITING ON CRITICAL PHASE 7 TABLES
-- ============================================================================
-- These tables contain sensitive operations data

SELECT audit.enable_tracking('public.packages'::regclass);
SELECT audit.enable_tracking('public.providers'::regclass);
SELECT audit.enable_tracking('public.provider_documents'::regclass);
SELECT audit.enable_tracking('public.move_requests'::regclass);
SELECT audit.enable_tracking('public.move_deposits'::regclass);

-- ============================================================================
-- PERMISSIONS
-- ============================================================================
-- No RLS on audit.audit_log - only service_role writes, admins read via functions

-- Grant SELECT to authenticated for viewing audit trails (filtered by functions/views)
GRANT SELECT ON audit.audit_log TO authenticated;

-- Grant INSERT to service_role (triggers run as SECURITY DEFINER)
GRANT INSERT ON audit.audit_log TO service_role;
GRANT ALL ON audit.audit_log TO service_role;
