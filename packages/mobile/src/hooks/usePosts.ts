import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ---------- useChannels ----------

export function useChannels() {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts.list(communityId!).queryKey, 'channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, description, channel_type, icon, anyone_can_post, requires_moderation')
        .eq('community_id', communityId!)
        .eq('status', 'active' as never)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- usePosts ----------

export function usePosts(channelId?: string | null) {
  const { communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts.list(communityId!).queryKey, channelId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`
          id, title, content, post_type, media_urls,
          poll_options, poll_ends_at, poll_results,
          reaction_counts, comment_count, view_count,
          is_pinned, created_at,
          channels!inner(id, name, icon),
          residents!posts_author_id_fkey(id, first_name, paternal_surname, photo_url)
        `)
        .eq('community_id', communityId!)
        .is('deleted_at', null)
        .eq('is_hidden', false)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (channelId) {
        query = query.eq('channel_id', channelId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!communityId,
  });
}

// ---------- usePostDetail ----------

export function usePostDetail(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.detail(postId).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id, title, content, post_type, media_urls,
          poll_options, poll_ends_at, poll_results,
          reaction_counts, comment_count, view_count,
          is_pinned, is_locked, created_at,
          channels(id, name, icon),
          residents!posts_author_id_fkey(id, first_name, paternal_surname, photo_url)
        `)
        .eq('id', postId)
        .single();

      if (error) throw error;

      // Fire-and-forget view count increment
      supabase.rpc('increment_post_view_count', { p_post_id: postId });

      return data;
    },
    enabled: !!postId,
  });
}

// ---------- usePostComments ----------

export function usePostComments(postId: string) {
  return useQuery({
    queryKey: queryKeys.posts.comments(postId).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id, content, parent_comment_id, root_comment_id, depth,
          is_hidden, created_at,
          residents!post_comments_author_id_fkey(id, first_name, paternal_surname, photo_url)
        `)
        .eq('post_id', postId)
        .is('deleted_at', null)
        .eq('is_hidden', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });
}

// ---------- useMyPostReactions ----------

export function useMyPostReactions() {
  const { residentId, communityId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts._def, 'my-reactions', residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('post_id')
        .eq('resident_id', residentId!)
        .eq('community_id', communityId!);

      if (error) throw error;
      return new Set((data ?? []).map((r) => r.post_id));
    },
    enabled: !!residentId && !!communityId,
  });
}

// ---------- useCreatePost ----------

interface CreatePostInput {
  channel_id: string;
  post_type: string;
  title?: string;
  content: string;
  media_urls?: string[];
  poll_options?: { text: string }[];
  poll_ends_at?: string;
}

export function useCreatePost() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      // Map UI post types to DB enum values
      const dbPostType =
        input.post_type === 'poll' ? 'poll' : 'discussion';

      const { data, error } = await supabase
        .from('posts')
        .insert({
          community_id: communityId!,
          channel_id: input.channel_id,
          author_id: residentId!,
          post_type: dbPostType as never,
          title: input.title ?? undefined,
          content: input.content,
          media_urls: input.media_urls ?? undefined,
          poll_options: input.poll_options
            ? (input.poll_options as never)
            : undefined,
          poll_ends_at: input.poll_ends_at ?? undefined,
          poll_results: input.poll_options
            ? (Object.fromEntries(
                input.poll_options.map((opt, i) => [String(i), 0])
              ) as never)
            : undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
  });
}

// ---------- useToggleReaction ----------

export function useToggleReaction() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      reactionType,
    }: {
      postId: string;
      reactionType: string;
    }) => {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('resident_id', residentId!)
        .maybeSingle();

      const wasLiked = !!existing;

      if (existing) {
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_reactions').insert({
          community_id: communityId!,
          post_id: postId,
          resident_id: residentId!,
          reaction_type: reactionType,
        });
        if (error) throw error;
      }

      return { wasLiked };
    },
    onMutate: async ({ postId, reactionType }) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.posts._def });
      await queryClient.cancelQueries({ queryKey: [...queryKeys.posts._def, 'my-reactions'] });

      // Snapshot previous values
      const prevMyReactions = queryClient.getQueryData<Set<string>>(
        [...queryKeys.posts._def, 'my-reactions', residentId]
      );

      // Optimistically update my-reactions set
      const isCurrentlyLiked = prevMyReactions?.has(postId) ?? false;
      const nextSet = new Set(prevMyReactions);
      if (isCurrentlyLiked) {
        nextSet.delete(postId);
      } else {
        nextSet.add(postId);
      }
      queryClient.setQueryData(
        [...queryKeys.posts._def, 'my-reactions', residentId],
        nextSet,
      );

      // Optimistically update reaction_counts on all post queries in cache
      const delta = isCurrentlyLiked ? -1 : 1;
      queryClient.setQueriesData<any[]>(
        { queryKey: queryKeys.posts._def },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((post: any) => {
            if (post.id !== postId) return post;
            const counts = { ...(post.reaction_counts ?? {}) };
            counts[reactionType] = Math.max(0, (counts[reactionType] ?? 0) + delta);
            return { ...post, reaction_counts: counts };
          });
        },
      );

      // Optimistically update the detail query if cached
      const detailKey = queryKeys.posts.detail(postId).queryKey;
      const prevDetail = queryClient.getQueryData<any>(detailKey);
      if (prevDetail) {
        const counts = { ...(prevDetail.reaction_counts ?? {}) };
        counts[reactionType] = Math.max(0, (counts[reactionType] ?? 0) + delta);
        queryClient.setQueryData(detailKey, { ...prevDetail, reaction_counts: counts });
      }

      return { prevMyReactions, prevDetail };
    },
    onError: (_err, variables, context) => {
      // Rollback optimistic updates on error
      if (context?.prevMyReactions) {
        queryClient.setQueryData(
          [...queryKeys.posts._def, 'my-reactions', residentId],
          context.prevMyReactions,
        );
      }
      // Refetch to get accurate server state
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
    onSettled: (_data, _error, variables) => {
      // Always refetch after mutation settles for consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
      queryClient.invalidateQueries({ queryKey: [...queryKeys.posts._def, 'my-reactions'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.detail(variables.postId).queryKey });
    },
  });
}

// ---------- useCreateComment ----------

interface CreateCommentInput {
  post_id: string;
  content: string;
  parent_comment_id?: string;
}

export function useCreateComment() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCommentInput) => {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          community_id: communityId!,
          post_id: input.post_id,
          author_id: residentId!,
          content: input.content,
          parent_comment_id: input.parent_comment_id ?? undefined,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.comments(variables.post_id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(variables.post_id).queryKey,
      });
    },
  });
}

// ---------- useVotePoll ----------

export function useVotePoll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      optionIndex,
    }: {
      postId: string;
      optionIndex: number;
    }) => {
      const { data, error } = await supabase.rpc('vote_on_poll' as never, {
        p_post_id: postId,
        p_option_index: optionIndex,
      } as never);

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
  });
}
