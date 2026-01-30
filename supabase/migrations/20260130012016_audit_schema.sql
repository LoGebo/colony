-- Migration: audit_schema
-- Phase: 07-operations-compliance
-- Plan: 04 (Audit Logs & Compliance)
-- Task: 1 - Create audit schema and operation enum
-- Description: Dedicated schema for audit infrastructure separating from public tables
-- Patterns: Follows Phase 4 immutability patterns for audit trail

-- ============================================================================
-- AUDIT SCHEMA
-- ============================================================================
-- Create audit schema to separate audit infrastructure from public tables
CREATE SCHEMA IF NOT EXISTS audit;

COMMENT ON SCHEMA audit IS 'Audit logging infrastructure - immutable audit trails for compliance';

-- ============================================================================
-- OPERATION ENUM
-- ============================================================================
-- Operation types for audit entries
CREATE TYPE audit.operation AS ENUM (
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE'
);

COMMENT ON TYPE audit.operation IS 'Database operation types tracked in audit log';

-- ============================================================================
-- SCHEMA PERMISSIONS
-- ============================================================================
-- Allow authenticated users to read from audit schema (for their own audit trails)
GRANT USAGE ON SCHEMA audit TO authenticated;

-- Service role needs full access for triggers running as SECURITY DEFINER
GRANT ALL ON SCHEMA audit TO service_role;
