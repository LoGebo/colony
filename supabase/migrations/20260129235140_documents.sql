-- ============================================
-- DOCUMENTS AND DOCUMENT VERSIONS TABLES
-- ============================================
-- Document management with copy-on-write versioning
-- Phase 6: Documents & Notifications

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
-- Main document entity with current version pointer

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE RESTRICT,

  -- Document metadata
  name TEXT NOT NULL,
  category document_category NOT NULL,
  description TEXT,

  -- Current version pointer (FK added after document_versions table created)
  current_version_id UUID,

  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT FALSE,          -- Visible to all residents
  required_role user_role,                            -- Minimum role to view if not public

  -- Signature requirements
  requires_signature BOOLEAN NOT NULL DEFAULT FALSE,
  signature_deadline DATE,

  -- Categorization
  tags TEXT[],

  -- Status
  status general_status NOT NULL DEFAULT 'active',

  -- Audit columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Audit trigger
CREATE TRIGGER set_documents_audit
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_audit_fields();

-- ============================================
-- DOCUMENT VERSIONS TABLE
-- ============================================
-- Copy-on-write versioning for documents

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- Version info
  version_number INTEGER NOT NULL,

  -- Storage reference
  storage_path TEXT NOT NULL,             -- Path in Supabase Storage
  storage_bucket TEXT NOT NULL DEFAULT 'documents',

  -- File metadata
  file_name TEXT NOT NULL,                -- Original filename
  file_size_bytes INTEGER,
  mime_type TEXT NOT NULL,
  checksum TEXT,                          -- SHA-256 for integrity verification

  -- Change tracking
  change_summary TEXT,                    -- What changed in this version

  -- Uploader
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),

  -- Version chain (previous version link)
  previous_version_id UUID REFERENCES document_versions(id),

  -- Timestamp (no updated_at - versions are immutable)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Unique version number per document
  CONSTRAINT document_versions_unique_number UNIQUE (document_id, version_number)
);

-- Enable RLS
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ADD FK FROM DOCUMENTS TO CURRENT VERSION
-- ============================================
ALTER TABLE documents
  ADD CONSTRAINT documents_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id);

-- ============================================
-- TRIGGER: SET VERSION NUMBER AND CHAIN
-- ============================================
-- Auto-increment version number and link previous version

CREATE OR REPLACE FUNCTION set_document_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  next_version INTEGER;
  prev_version_id UUID;
BEGIN
  -- Get next version number and current max version_id
  SELECT COALESCE(MAX(version_number), 0) + 1,
         (SELECT id FROM document_versions
          WHERE document_id = NEW.document_id
          ORDER BY version_number DESC LIMIT 1)
  INTO next_version, prev_version_id
  FROM document_versions
  WHERE document_id = NEW.document_id;

  NEW.version_number := next_version;
  NEW.previous_version_id := prev_version_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER document_version_trigger
  BEFORE INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION set_document_version();

-- ============================================
-- TRIGGER: UPDATE CURRENT VERSION POINTER
-- ============================================
-- After inserting new version, update documents current_version_id

CREATE OR REPLACE FUNCTION update_document_current_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE documents
  SET current_version_id = NEW.id,
      updated_at = now()
  WHERE id = NEW.document_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER document_current_version_trigger
  AFTER INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_document_current_version();

-- ============================================
-- FUNCTION: UPLOAD DOCUMENT VERSION
-- ============================================
-- Helper function to upload a new version

CREATE OR REPLACE FUNCTION upload_document_version(
  p_document_id UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_file_size INTEGER,
  p_mime_type TEXT,
  p_checksum TEXT DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS document_versions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result document_versions;
BEGIN
  INSERT INTO document_versions (
    document_id,
    storage_path,
    file_name,
    file_size_bytes,
    mime_type,
    checksum,
    change_summary,
    uploaded_by
  )
  VALUES (
    p_document_id,
    p_storage_path,
    p_file_name,
    p_file_size,
    p_mime_type,
    p_checksum,
    p_change_summary,
    auth.uid()
  )
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION upload_document_version IS
  'Upload a new version of a document. Auto-increments version_number and updates current_version_id.';

-- ============================================
-- FUNCTION: GET DOCUMENT HISTORY
-- ============================================
-- Returns all versions of a document with uploader info

CREATE OR REPLACE FUNCTION get_document_history(p_document_id UUID)
RETURNS TABLE (
  version_id UUID,
  version_number INTEGER,
  file_name TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  checksum TEXT,
  change_summary TEXT,
  uploaded_by UUID,
  uploader_email TEXT,
  created_at TIMESTAMPTZ,
  previous_version_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dv.id AS version_id,
    dv.version_number,
    dv.file_name,
    dv.file_size_bytes,
    dv.mime_type,
    dv.checksum,
    dv.change_summary,
    dv.uploaded_by,
    u.email AS uploader_email,
    dv.created_at,
    dv.previous_version_id
  FROM document_versions dv
  LEFT JOIN auth.users u ON u.id = dv.uploaded_by
  WHERE dv.document_id = p_document_id
  ORDER BY dv.version_number DESC;
END;
$$;

COMMENT ON FUNCTION get_document_history IS
  'Returns all versions of a document ordered by version number descending.';

-- ============================================
-- INDEXES
-- ============================================

-- Documents indexes
CREATE INDEX idx_documents_community_category ON documents(community_id, category, status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_documents_requires_signature ON documents(community_id, requires_signature, signature_deadline)
  WHERE deleted_at IS NULL AND requires_signature = TRUE;

CREATE INDEX idx_documents_public ON documents(community_id, is_public)
  WHERE deleted_at IS NULL AND is_public = TRUE;

CREATE INDEX idx_documents_tags ON documents USING GIN (tags)
  WHERE deleted_at IS NULL;

-- Document versions indexes
CREATE INDEX idx_document_versions_document ON document_versions(document_id, version_number DESC);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Super admins full access on documents
CREATE POLICY "super_admins_full_access_documents"
  ON documents
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Super admins full access on document_versions
CREATE POLICY "super_admins_full_access_document_versions"
  ON document_versions
  FOR ALL
  TO authenticated
  USING ((SELECT is_super_admin()));

-- Admins can manage all community documents
CREATE POLICY "admins_manage_community_documents"
  ON documents
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

-- Users can view public documents
CREATE POLICY "users_view_public_documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND is_public = TRUE
    AND deleted_at IS NULL
    AND status = 'active'
  );

-- Users can view documents based on required_role
CREATE POLICY "users_view_role_documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    community_id = (SELECT get_current_community_id())
    AND deleted_at IS NULL
    AND status = 'active'
    AND required_role IS NOT NULL
    AND (
      CASE (SELECT get_current_user_role())
        WHEN 'super_admin' THEN TRUE
        WHEN 'admin' THEN required_role IN ('admin', 'manager', 'guard', 'resident', 'provider', 'visitor')
        WHEN 'manager' THEN required_role IN ('manager', 'guard', 'resident', 'provider', 'visitor')
        WHEN 'guard' THEN required_role IN ('guard', 'resident', 'provider', 'visitor')
        WHEN 'resident' THEN required_role IN ('resident', 'provider', 'visitor')
        WHEN 'provider' THEN required_role IN ('provider', 'visitor')
        WHEN 'visitor' THEN required_role = 'visitor'
        ELSE FALSE
      END
    )
  );

-- Document versions: same access as parent document
CREATE POLICY "users_view_document_versions"
  ON document_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
      -- RLS on documents table will filter appropriately
    )
  );

-- Admins can insert document versions
CREATE POLICY "admins_insert_document_versions"
  ON document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
      AND d.community_id = (SELECT get_current_community_id())
      AND (SELECT get_current_user_role()) IN ('admin', 'manager')
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE documents IS
  'Community documents with version tracking and access control.
   Use is_public for all-resident access, or required_role for role-based access.
   Signature requirements tracked via requires_signature and signature_deadline.';

COMMENT ON COLUMN documents.current_version_id IS
  'Pointer to latest version for O(1) access. Updated automatically by trigger.';

COMMENT ON COLUMN documents.required_role IS
  'Minimum role required to view document. NULL means permission-based access.';

COMMENT ON TABLE document_versions IS
  'Copy-on-write versioning for documents. Each edit creates a new version.
   Version numbers auto-increment per document. Versions are immutable.';

COMMENT ON COLUMN document_versions.checksum IS
  'SHA-256 hash for integrity verification and tamper detection.';

COMMENT ON COLUMN document_versions.previous_version_id IS
  'Link to previous version for version chain traversal.';
