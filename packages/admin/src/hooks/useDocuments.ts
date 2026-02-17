'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, STORAGE_BUCKETS } from '@upoe/shared';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { toastError } from '@/lib/toast-error';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface DocumentRow {
  id: string;
  name: string;
  category: string;
  description: string | null;
  is_public: boolean;
  requires_signature: boolean;
  status: string;
  current_version_id: string | null;
  required_role: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentFilters {
  search?: string;
  category?: string;
  page: number;
  pageSize: number;
}

export interface CreateDocumentInput {
  name: string;
  category: string;
  description?: string;
  is_public: boolean;
  requires_signature: boolean;
  file: File;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

export const DOCUMENT_CATEGORIES = [
  { value: 'legal', label: 'Legal' },
  { value: 'assembly', label: 'Asamblea' },
  { value: 'financial', label: 'Financiero' },
  { value: 'operational', label: 'Operativo' },
  { value: 'communication', label: 'Comunicacion' },
] as const;

/* ------------------------------------------------------------------ */
/*  Queries                                                           */
/* ------------------------------------------------------------------ */

/**
 * Paginated document list with search and category filters.
 */
export function useDocuments(filters: DocumentFilters) {
  const { communityId } = useAuth();
  const { search, category, page, pageSize } = filters;

  return useQuery({
    queryKey: [
      ...queryKeys.documents.list(communityId!).queryKey,
      { search, category, page, pageSize },
    ],
    queryFn: async () => {
      const supabase = createClient();
      let query = supabase
        .from('documents')
        .select(
          'id, name, category, description, is_public, requires_signature, status, current_version_id, required_role, tags, created_at, updated_at',
          { count: 'exact' }
        )
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (category) query = query.eq('category', category as never);
      if (search) query = query.ilike('name', `%${search}%`);

      const from = page * pageSize;
      query = query.range(from, from + pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: (data ?? []) as unknown as DocumentRow[], count: count ?? 0 };
    },
    enabled: !!communityId,
  });
}

/**
 * Distinct document categories for the filter dropdown.
 */
export function useDocumentCategories() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.documents.list(communityId!).queryKey, 'categories'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('documents')
        .select('category')
        .eq('community_id', communityId!)
        .is('deleted_at', null);

      if (error) throw error;
      // Extract unique categories
      const categories = [...new Set((data ?? []).map((d) => d.category))];
      return categories.sort();
    },
    enabled: !!communityId,
  });
}

/* ------------------------------------------------------------------ */
/*  Mutations                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create a new document: upload file to storage, then insert document + version records.
 * Actual DB schema: documents.name, documents.is_public, documents.category (enum),
 * document_versions.storage_path, storage_bucket, file_size_bytes, version_number, uploaded_by.
 */
export function useCreateDocument() {
  const { communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Upload file to storage
      const fileExt = input.file.name.split('.').pop();
      const storagePath = `${communityId!}/documents/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.DOCUMENT_FILES)
        .upload(storagePath, input.file);
      if (uploadError) throw uploadError;

      // 2. Insert document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .insert({
          community_id: communityId!,
          name: input.name,
          category: input.category as never,
          description: input.description || null,
          is_public: input.is_public,
          requires_signature: input.requires_signature,
          created_by: user!.id,
        })
        .select()
        .single();
      if (docError) throw docError;

      // 3. Insert document version (trigger auto-sets version number + updates current_version_id)
      const { error: versionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: doc.id,
          storage_path: storagePath,
          storage_bucket: STORAGE_BUCKETS.DOCUMENT_FILES,
          file_name: input.file.name,
          file_size_bytes: input.file.size,
          mime_type: input.file.type || 'application/octet-stream',
          uploaded_by: user!.id,
          version_number: 1,
        });
      if (versionError) throw versionError;

      return doc;
    },
    onSuccess: () => {
      toast.success('Documento subido exitosamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.documents._def });
    },
    onError: (error: Error) => {
      toastError('Error al subir documento', error);
    },
  });
}

/**
 * Toggle document public/private visibility.
 */
export function useUpdateDocumentVisibility() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ docId, isPublic }: { docId: string; isPublic: boolean }) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('documents')
        .update({ is_public: isPublic })
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Visibilidad actualizada');
      queryClient.invalidateQueries({ queryKey: queryKeys.documents._def });
    },
    onError: (error: Error) => {
      toastError('Error al actualizar visibilidad', error);
    },
  });
}

/**
 * Soft-delete a document.
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (docId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from('documents')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Documento eliminado');
      queryClient.invalidateQueries({ queryKey: queryKeys.documents._def });
    },
    onError: (error: Error) => {
      toastError('Error al eliminar documento', error);
    },
  });
}
