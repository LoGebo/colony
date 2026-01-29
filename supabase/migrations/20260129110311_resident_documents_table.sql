-- Resident documents: metadata for files in Supabase Storage
CREATE TABLE resident_documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,

  -- Document metadata
  document_type document_type NOT NULL,
  name TEXT NOT NULL,                  -- User-friendly name
  description TEXT,

  -- Storage reference
  -- Path format: {community_id}/{resident_id}/{document_type}/{filename}
  storage_path TEXT NOT NULL,
  storage_bucket TEXT NOT NULL DEFAULT 'resident-documents',

  -- File metadata
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type TEXT,

  -- Validity
  issued_at DATE,
  expires_at DATE,

  -- Verification workflow
  verification_status approval_status NOT NULL DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE resident_documents ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_resident_documents_audit
  BEFORE INSERT OR UPDATE ON resident_documents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- Indexes
CREATE INDEX idx_resident_documents_resident ON resident_documents(resident_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resident_documents_community ON resident_documents(community_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_resident_documents_type ON resident_documents(resident_id, document_type) WHERE deleted_at IS NULL;
CREATE INDEX idx_resident_documents_verification ON resident_documents(community_id, verification_status)
  WHERE deleted_at IS NULL;

-- Index for expiring documents (useful for reminders)
CREATE INDEX idx_resident_documents_expiring
  ON resident_documents(expires_at, document_type)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

-- Partial unique index: prevent duplicate active documents of same type per resident
-- (allows re-uploading after rejection or deletion)
CREATE UNIQUE INDEX idx_resident_documents_unique_active_type
  ON resident_documents(resident_id, document_type)
  WHERE deleted_at IS NULL AND verification_status != 'rejected';

-- RLS Policies

-- Super admins full access
CREATE POLICY "super_admins_full_access_documents"
  ON resident_documents
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Users can view their own documents
CREATE POLICY "users_view_own_documents"
  ON resident_documents
  FOR SELECT
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND deleted_at IS NULL
  );

-- Users can upload their own documents
CREATE POLICY "users_upload_own_documents"
  ON resident_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    resident_id = auth.uid()
    AND community_id = (SELECT get_current_community_id())
  );

-- Users can update their own pending documents (before verification)
CREATE POLICY "users_update_own_pending_documents"
  ON resident_documents
  FOR UPDATE
  TO authenticated
  USING (
    resident_id = auth.uid()
    AND verification_status = 'pending'
    AND deleted_at IS NULL
  )
  WITH CHECK (
    resident_id = auth.uid()
    AND verification_status = 'pending'
  );

-- Admins can view all community documents
CREATE POLICY "admins_view_community_documents"
  ON resident_documents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Admins can manage all community documents (verify, reject)
CREATE POLICY "admins_manage_community_documents"
  ON resident_documents
  FOR ALL
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  )
  WITH CHECK (
    community_id = (SELECT get_current_community_id())
    AND (SELECT get_current_user_role()) IN ('admin', 'manager')
  );

-- Comments
COMMENT ON TABLE resident_documents IS 'Document metadata with verification workflow, files stored in Supabase Storage';
COMMENT ON COLUMN resident_documents.storage_path IS 'Path format: {community_id}/{resident_id}/{document_type}/{filename}';
COMMENT ON COLUMN resident_documents.verification_status IS 'Workflow: pending -> approved or rejected';
