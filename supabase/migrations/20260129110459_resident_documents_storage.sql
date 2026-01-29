-- Create the storage bucket for resident documents
-- Note: This requires the storage schema to exist (part of Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resident-documents',
  'resident-documents',
  false,  -- Private bucket (requires RLS for access)
  10485760,  -- 10MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "users_upload_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "users_view_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "users_update_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "users_delete_own_documents" ON storage.objects;
DROP POLICY IF EXISTS "admins_view_community_documents" ON storage.objects;
DROP POLICY IF EXISTS "admins_manage_community_documents" ON storage.objects;
DROP POLICY IF EXISTS "super_admins_full_access_storage" ON storage.objects;

-- RLS policy: Users can upload to their own folder
-- Path structure: {community_id}/{resident_id}/{document_type}/{filename}
CREATE POLICY "users_upload_own_documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[1] = (SELECT get_current_community_id())::TEXT
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Users can view their own documents
CREATE POLICY "users_view_own_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Users can update their own documents
CREATE POLICY "users_update_own_documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
)
WITH CHECK (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Users can delete their own documents
CREATE POLICY "users_delete_own_documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[2] = auth.uid()::TEXT
);

-- RLS policy: Admins can view all community documents
CREATE POLICY "admins_view_community_documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[1] = (SELECT get_current_community_id())::TEXT
  AND (SELECT get_current_user_role()) IN ('admin', 'manager')
);

-- RLS policy: Admins can manage all community documents
CREATE POLICY "admins_manage_community_documents"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (storage.foldername(name))[1] = (SELECT get_current_community_id())::TEXT
  AND (SELECT get_current_user_role()) IN ('admin', 'manager')
);

-- Super admins full access
CREATE POLICY "super_admins_full_access_storage"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'resident-documents'
  AND (SELECT is_super_admin())
);
