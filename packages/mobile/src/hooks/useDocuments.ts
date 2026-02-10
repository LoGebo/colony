import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Platform, Dimensions } from 'react-native';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useMyDocuments ----------

export function useMyDocuments() {
  const { communityId, user } = useAuth();

  return useQuery({
    queryKey: queryKeys.documents.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_accessible_documents' as never, {
        p_user_id: user!.id,
      } as never);
      if (error) throw error;
      return data as Array<{
        document_id: string;
        name: string;
        description: string | null;
        category: string;
        is_public: boolean;
        requires_signature: boolean;
        current_version_id: string | null;
        access_source: string;
      }>;
    },
    enabled: !!communityId && !!user,
  });
}

// ---------- usePendingSignatures ----------

export function usePendingSignatures() {
  const { communityId, residentId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.documents.list(communityId!).queryKey, 'pending-signatures'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_signatures' as never, {
        p_resident_id: residentId!,
      } as never);
      if (error) throw error;
      return data as Array<{
        document_id: string;
        document_name: string;
        category: string;
        current_version_id: string | null;
        signature_deadline: string | null;
        days_until_deadline: number | null;
      }>;
    },
    enabled: !!communityId && !!residentId,
  });
}

// ---------- useDocumentDetail ----------

export function useDocumentDetail(documentId: string) {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: queryKeys.documents.detail(documentId).queryKey,
    queryFn: async () => {
      // Fetch document with latest version
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('id, name, description, category, is_public, requires_signature, signature_deadline, status, created_at')
        .eq('id', documentId)
        .single();

      if (docError) throw docError;

      // Fetch latest version
      const { data: versions, error: verError } = await supabase
        .from('document_versions')
        .select('id, version_number, storage_path, storage_bucket, file_name, file_size_bytes, created_at, change_summary')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1);

      if (verError) throw verError;

      // Check if current resident has signed
      let signature = null;
      if (residentId) {
        const { data: sig } = await supabase
          .from('regulation_signatures')
          .select('id, signed_at, consent_text')
          .eq('document_id', documentId)
          .eq('resident_id', residentId)
          .maybeSingle();
        signature = sig;
      }

      return {
        ...doc,
        latestVersion: versions?.[0] ?? null,
        signature,
      };
    },
    enabled: !!documentId,
  });
}

// ---------- useSignDocument ----------

export function useSignDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      document_id: string;
      document_version_id: string;
      consent_text: string;
    }) => {
      const { width, height } = Dimensions.get('window');

      const { data, error } = await supabase.rpc('capture_signature' as never, {
        p_document_id: input.document_id,
        p_document_version_id: input.document_version_id,
        p_signature_type: 'click',
        p_signature_data: null,
        p_ip_address: '0.0.0.0',
        p_user_agent: `UPOE-Mobile/${Platform.OS}`,
        p_consent_text: input.consent_text,
        p_device_type: Platform.OS === 'ios' || Platform.OS === 'android' ? 'phone' : 'tablet',
        p_os: `${Platform.OS} ${Platform.Version}`,
        p_screen_resolution: `${Math.round(width)}x${Math.round(height)}`,
        p_device_model: null,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents._def });
    },
  });
}
