import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { STORAGE_BUCKETS, getStoragePath } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useIncidentTypes ----------

/**
 * Fetches available incident types for the community.
 */
export function useIncidentTypes(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.incidents.types(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incident_types')
        .select('id, name, description, default_severity')
        .eq('community_id', communityId!)
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useIncidentList ----------

/**
 * Fetches recent incidents for the community (last 50).
 */
export function useIncidentList(communityId?: string) {
  return useQuery({
    queryKey: queryKeys.incidents.list(communityId!).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select(
          'id, incident_number, title, severity, status, created_at, location_description'
        )
        .eq('community_id', communityId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- useIncidentDetail ----------

/**
 * Fetches a single incident with all fields including JSONB timeline,
 * plus related incident_media.
 */
export function useIncidentDetail(id?: string) {
  return useQuery({
    queryKey: queryKeys.incidents.detail(id!).queryKey,
    queryFn: async () => {
      const [incidentResult, mediaResult] = await Promise.all([
        supabase
          .from('incidents')
          .select('*')
          .eq('id', id!)
          .single(),
        supabase
          .from('incident_media')
          .select('id, media_type, storage_path, caption, created_at')
          .eq('incident_id', id!)
          .order('created_at', { ascending: true }),
      ]);

      if (incidentResult.error) throw incidentResult.error;
      if (mediaResult.error) throw mediaResult.error;

      return {
        ...incidentResult.data,
        media: mediaResult.data,
      };
    },
    enabled: !!id,
  });
}

// ---------- useCreateIncident ----------

interface CreateIncidentInput {
  title: string;
  description: string;
  incident_type_id?: string;
  severity: string;
  location_type?: string;
  location_description?: string;
  gps_latitude?: number;
  gps_longitude?: number;
}

/**
 * Creates a new incident report.
 */
export function useCreateIncident() {
  const { communityId, guardId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIncidentInput) => {
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          community_id: communityId!,
          reported_by_guard: guardId!,
          title: input.title,
          description: input.description,
          incident_type_id: input.incident_type_id,
          severity: input.severity,
          location_type: input.location_type,
          location_description: input.location_description,
          gps_latitude: input.gps_latitude,
          gps_longitude: input.gps_longitude,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.incidents._def });
    },
  });
}

// ---------- useAddIncidentComment ----------

interface AddCommentInput {
  incidentId: string;
  commentText: string;
  isInternal?: boolean;
}

/**
 * Adds a follow-up comment to an incident timeline via RPC.
 */
export function useAddIncidentComment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AddCommentInput) => {
      const { data, error } = await supabase.rpc('add_incident_comment', {
        p_incident_id: input.incidentId,
        p_text: input.commentText,
        p_is_internal: input.isInternal ?? false,
        p_actor_id: user!.id,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(variables.incidentId).queryKey,
      });
    },
  });
}

// ---------- useUploadIncidentMedia ----------

interface UploadMediaInput {
  incidentId: string;
  communityId: string;
  imageUri: string;
  mediaType: 'photo' | 'video';
  caption?: string;
}

/**
 * Uploads evidence media (photo/video) for an incident.
 * Uploads to Storage then inserts incident_media record.
 */
export function useUploadIncidentMedia() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadMediaInput) => {
      const ext = input.imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8);

      const storagePath = getStoragePath(
        STORAGE_BUCKETS.INCIDENT_EVIDENCE,
        input.communityId,
        `${input.incidentId}/${timestamp}-${random}.${ext}`
      );

      // Fetch the image URI as ArrayBuffer
      const response = await fetch(input.imageUri);
      const arrayBuffer = await response.arrayBuffer();

      const contentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'mp4'
            ? 'video/mp4'
            : 'image/jpeg';

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKETS.INCIDENT_EVIDENCE)
        .upload(storagePath, arrayBuffer, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      // Insert the incident_media record
      const { data, error } = await supabase
        .from('incident_media')
        .insert({
          incident_id: input.incidentId,
          community_id: input.communityId,
          media_type: input.mediaType,
          storage_path: storagePath,
          caption: input.caption,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.detail(variables.incidentId).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.incidents.media(variables.incidentId).queryKey,
      });
    },
  });
}
