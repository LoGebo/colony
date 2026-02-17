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
        .eq('status', 'active')
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
      supabase.rpc('increment_post_view_count', { p_post_id: postId })
        .then(({ error: rpcErr }) => { if (rpcErr) console.warn('View count RPC failed:', rpcErr.message); });

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

// ---------- useMyPollVotes ----------

export function useMyPollVotes() {
  const { residentId } = useAuth();

  return useQuery({
    queryKey: [...queryKeys.posts._def, 'my-poll-votes', residentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('poll_votes')
        .select('post_id, option_index')
        .eq('resident_id', residentId!);

      if (error) throw error;
      // Map: postId → optionIndex the user voted for
      return new Map((data ?? []).map((v) => [v.post_id, v.option_index as number]));
    },
    enabled: !!residentId,
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
          post_type: dbPostType,
          title: input.title ?? undefined,
          content: input.content,
          media_urls: input.media_urls ?? undefined,
          poll_options: input.poll_options
            ? (input.poll_options as any)
            : undefined,
          poll_ends_at: input.poll_ends_at ?? undefined,
          poll_results: input.poll_options
            ? (Object.fromEntries(
                input.poll_options.map((opt, i) => [String(i), 0])
              ) as any)
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

/**
 * Optimistic like/unlike toggle with race-condition protection.
 *
 * Key design decisions:
 * - Caller passes `isLiked` so we never SELECT before DELETE/INSERT (atomic).
 * - `onSettled` only invalidates the lightweight `my-reactions` set.
 *   Post-list caches keep their optimistic counts until a natural refetch
 *   (pull-to-refresh, window focus, stale-time expiry) to avoid refetch storms.
 * - Concurrent-click protection is handled by the caller via a `pendingLikes` ref.
 */
export function useToggleReaction() {
  const { residentId, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      reactionType,
      isLiked,
    }: {
      postId: string;
      reactionType: string;
      isLiked: boolean;
    }) => {
      if (isLiked) {
        // Unlike: delete by compound key – no prior SELECT needed
        const { error } = await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('resident_id', residentId!);
        if (error) throw error;
      } else {
        // Like: insert new reaction
        const { error } = await supabase.from('post_reactions').insert({
          community_id: communityId!,
          post_id: postId,
          resident_id: residentId!,
          reaction_type: reactionType,
        });
        if (error) throw error;
      }

      return { wasLiked: isLiked };
    },
    onMutate: async ({ postId, reactionType, isLiked }) => {
      // Cancel in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.posts._def });

      const myReactionsKey = [...queryKeys.posts._def, 'my-reactions', residentId];

      // Snapshot previous values for rollback
      const prevMyReactions = queryClient.getQueryData<Set<string>>(myReactionsKey);

      // Optimistically update my-reactions set (using isLiked from caller, not cache)
      const nextSet = new Set(prevMyReactions);
      if (isLiked) {
        nextSet.delete(postId);
      } else {
        nextSet.add(postId);
      }
      queryClient.setQueryData(myReactionsKey, nextSet);

      // Optimistically update reaction_counts on all cached post lists
      const delta = isLiked ? -1 : 1;
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
      if (context?.prevDetail) {
        queryClient.setQueryData(
          queryKeys.posts.detail(variables.postId).queryKey,
          context.prevDetail,
        );
      }
      // Full refetch to resync with server on error
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
    onSettled: () => {
      // Only sync my-reactions (lightweight); post lists keep optimistic counts
      // until a natural refetch (pull-to-refresh / stale-time / window focus).
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.posts._def, 'my-reactions'],
      });
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
  const { residentId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      optionIndex,
    }: {
      postId: string;
      optionIndex: number;
    }) => {
      const { data, error } = await supabase.rpc('vote_on_poll', {
        p_post_id: postId,
        p_option_index: optionIndex,
      }) as { data: any; error: any };

      if (error) throw error;
      return data;
    },
    onMutate: async ({ postId, optionIndex }) => {
      const detailKey = queryKeys.posts.detail(postId).queryKey;
      const myVotesKey = [...queryKeys.posts._def, 'my-poll-votes', residentId];

      await queryClient.cancelQueries({ queryKey: detailKey });
      await queryClient.cancelQueries({ queryKey: myVotesKey });

      // Snapshots for rollback
      const prevDetail = queryClient.getQueryData<any>(detailKey);
      const prevMyVotes = queryClient.getQueryData<Map<string, number>>(myVotesKey);

      // User's previous vote (if any) – needed for change-vote logic
      const prevOptionIndex = prevMyVotes?.get(postId);

      // Optimistically update my-poll-votes
      const nextVotes = new Map(prevMyVotes);
      nextVotes.set(postId, optionIndex);
      queryClient.setQueryData(myVotesKey, nextVotes);

      // Helper: adjust poll_results for a vote (handles new vote AND vote change)
      const adjustResults = (post: any) => {
        const results = { ...(post.poll_results ?? {}) } as Record<string, number>;
        // Decrement old option when changing vote
        if (prevOptionIndex !== undefined && prevOptionIndex !== optionIndex) {
          const oldKey = String(prevOptionIndex);
          results[oldKey] = Math.max(0, (results[oldKey] ?? 0) - 1);
        }
        // Increment new option (new vote or changed vote)
        const newKey = String(optionIndex);
        results[newKey] = (results[newKey] ?? 0) + 1;
        return results;
      };

      // Optimistically update detail query
      if (prevDetail) {
        queryClient.setQueryData(detailKey, {
          ...prevDetail,
          poll_results: adjustResults(prevDetail),
        });
      }

      // Optimistically update cached list queries
      queryClient.setQueriesData<any[]>(
        { queryKey: queryKeys.posts._def },
        (old) => {
          if (!Array.isArray(old)) return old;
          return old.map((post: any) => {
            if (post.id !== postId) return post;
            return { ...post, poll_results: adjustResults(post) };
          });
        },
      );

      return { prevDetail, prevMyVotes };
    },
    onError: (_err, variables, context) => {
      if (context?.prevDetail) {
        queryClient.setQueryData(
          queryKeys.posts.detail(variables.postId).queryKey,
          context.prevDetail,
        );
      }
      if (context?.prevMyVotes) {
        queryClient.setQueryData(
          [...queryKeys.posts._def, 'my-poll-votes', residentId],
          context.prevMyVotes,
        );
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.posts._def });
    },
    onSettled: (_data, _error, variables) => {
      // Refetch detail + my votes for server confirmation
      queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(variables.postId).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.posts._def, 'my-poll-votes'],
      });
    },
  });
}
