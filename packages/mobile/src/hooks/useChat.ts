import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { queryKeys } from '@upoe/shared';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

// ─── Types ────────────────────────────────────────────────────────

export interface ConversationListItem {
  conversation_id: string;
  conversation_type: 'direct' | 'group' | 'guard_booth' | 'support';
  name: string | null;
  description: string | null;
  avatar_url: string | null;
  is_archived: boolean;
  participant_count: number;
  message_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  is_muted: boolean;
  other_participant_name: string | null;
  other_participant_user_id: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_urls: string[] | null;
  media_types: string[] | null;
  reply_to_message_id: string | null;
  message_type: string;
  system_data: Record<string, unknown> | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  created_at: string;
  // Joined data
  sender_name?: string;
  sender_avatar?: string | null;
  reply_to?: {
    id: string;
    content: string | null;
    sender_name: string;
  } | null;
  reactions?: { reaction: string; user_id: string }[];
  _optimistic?: boolean;
}

export interface SearchMessageResult {
  message_id: string;
  conversation_id: string;
  conversation_name: string | null;
  conversation_type: string;
  sender_id: string;
  sender_name: string;
  content: string;
  content_highlight: string;
  created_at: string;
}

const PAGE_SIZE = 30;

// ─── useConversations ─────────────────────────────────────────────

export function useConversations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_conversation_list', {
        p_user_id: user!.id,
        p_limit: 50,
        p_offset: 0,
      });
      if (error) throw error;
      return (data ?? []) as ConversationListItem[];
    },
    enabled: !!user?.id,
  });

  // Realtime: listen for conversation changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.list(user.id).queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.list(user.id).queryKey,
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id, queryClient]);

  return query;
}

// ─── useMessages ──────────────────────────────────────────────────

export function useMessages(conversationId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: [...queryKeys.conversations.messages(conversationId ?? '').queryKey],
    queryFn: async ({ pageParam = 0 }) => {
      // Fetch messages with sender info
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id, conversation_id, sender_id, content, media_urls, media_types,
          reply_to_message_id, message_type, system_data,
          is_edited, edited_at, is_deleted, created_at
        `)
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (error) throw error;

      // Gather unique sender IDs to fetch names
      const senderIds = [...new Set((data ?? []).map((m) => m.sender_id))];
      const replyIds = (data ?? [])
        .map((m) => m.reply_to_message_id)
        .filter(Boolean) as string[];

      // Fetch sender info from residents + guards
      const [residentsResult, guardsResult, repliesResult, reactionsResult] =
        await Promise.all([
          senderIds.length > 0
            ? supabase
                .from('residents')
                .select('user_id, first_name, paternal_surname, photo_url')
                .in('user_id', senderIds)
            : { data: [] },
          senderIds.length > 0
            ? supabase
                .from('guards')
                .select('user_id, first_name, paternal_surname, photo_url')
                .in('user_id', senderIds)
            : { data: [] },
          replyIds.length > 0
            ? supabase
                .from('messages')
                .select('id, content, sender_id')
                .in('id', replyIds)
            : { data: [] },
          supabase
            .from('message_reactions')
            .select('message_id, reaction, user_id')
            .in(
              'message_id',
              (data ?? []).map((m) => m.id)
            ),
        ]);

      // Build sender lookup
      const senderMap = new Map<
        string,
        { name: string; avatar: string | null }
      >();
      for (const r of residentsResult.data ?? []) {
        if (r.user_id) {
          senderMap.set(r.user_id, {
            name: `${r.first_name} ${r.paternal_surname}`,
            avatar: r.photo_url,
          });
        }
      }
      for (const g of guardsResult.data ?? []) {
        if (g.user_id && !senderMap.has(g.user_id)) {
          senderMap.set(g.user_id, {
            name: `${g.first_name} ${g.paternal_surname}`,
            avatar: g.photo_url,
          });
        }
      }

      // Build reply lookup
      const replyMap = new Map<
        string,
        { id: string; content: string | null; sender_name: string }
      >();
      for (const r of repliesResult.data ?? []) {
        const sender = senderMap.get(r.sender_id);
        replyMap.set(r.id, {
          id: r.id,
          content: r.content,
          sender_name: sender?.name ?? 'Unknown',
        });
      }

      // Build reactions map
      const reactionsMap = new Map<
        string,
        { reaction: string; user_id: string }[]
      >();
      for (const r of reactionsResult.data ?? []) {
        const existing = reactionsMap.get(r.message_id) ?? [];
        existing.push({ reaction: r.reaction, user_id: r.user_id });
        reactionsMap.set(r.message_id, existing);
      }

      // Enrich messages
      const enriched: ChatMessage[] = (data ?? []).map((m) => {
        const sender = senderMap.get(m.sender_id);
        return {
          ...m,
          system_data: m.system_data as Record<string, unknown> | null,
          sender_name: sender?.name ?? 'Unknown',
          sender_avatar: sender?.avatar ?? null,
          reply_to: m.reply_to_message_id
            ? replyMap.get(m.reply_to_message_id) ?? null
            : null,
          reactions: reactionsMap.get(m.id) ?? [],
        };
      });

      return enriched;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.flat().length;
    },
    initialPageParam: 0,
    enabled: !!conversationId && !!user?.id,
  });

  // Realtime: new messages
  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.sender_id === user.id) {
            // Own message — onSuccess already swapped optimistic with real data.
            // Only refresh conversation list for last-message preview.
            queryClient.invalidateQueries({
              queryKey: queryKeys.conversations.list(user.id).queryKey,
            });
            return;
          }
          // Other user's message — invalidate to get enriched version
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(conversationId).queryKey,
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.list(user.id).queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(conversationId).queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.conversations.messages(conversationId).queryKey,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Other participant read messages — refresh read positions
          queryClient.invalidateQueries({
            queryKey: readPositionsKey(conversationId),
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId, user?.id, queryClient]);

  return query;
}

// ─── useReadPositions ────────────────────────────────────────────

/** Stable query key for read-position data. */
function readPositionsKey(conversationId: string) {
  return [...queryKeys.conversations.participants(conversationId).queryKey, 'read-positions'] as const;
}

/**
 * Returns the `created_at` of the latest message that any other participant
 * has read. Own messages with `created_at <= lastReadAt` are considered "read".
 */
export function useReadPositions(conversationId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: readPositionsKey(conversationId ?? ''),
    queryFn: async () => {
      // Step 1: Get other participants' last_read_message_id
      const { data: participants, error: pErr } = await supabase
        .from('conversation_participants')
        .select('last_read_message_id')
        .eq('conversation_id', conversationId!)
        .neq('user_id', user!.id)
        .not('last_read_message_id', 'is', null);

      if (pErr) throw pErr;
      if (!participants || participants.length === 0) return null;

      const messageIds = participants
        .map((p) => p.last_read_message_id)
        .filter(Boolean) as string[];
      if (messageIds.length === 0) return null;

      // Step 2: Find the latest-read message's created_at
      const { data: msgs, error: mErr } = await supabase
        .from('messages')
        .select('created_at')
        .in('id', messageIds)
        .order('created_at', { ascending: false })
        .limit(1);

      if (mErr) throw mErr;
      return msgs?.[0]?.created_at ?? null;
    },
    enabled: !!conversationId && !!user?.id,
  });
}

// ─── useSendMessage ───────────────────────────────────────────────

interface SendMessageInput {
  conversationId: string;
  content?: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  replyToMessageId?: string;
  messageType?: string;
}

export function useSendMessage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          sender_id: user!.id,
          content: input.content ?? null,
          media_urls: input.mediaUrls ?? null,
          media_types: input.mediaTypes ?? null,
          reply_to_message_id: input.replyToMessageId ?? null,
          message_type: input.messageType ?? 'text',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: async (input) => {
      const messagesKey = [
        ...queryKeys.conversations.messages(input.conversationId).queryKey,
      ];
      await queryClient.cancelQueries({ queryKey: messagesKey });

      const optimisticId = `optimistic-${Date.now()}`;
      const optimisticMsg: ChatMessage = {
        id: optimisticId,
        conversation_id: input.conversationId,
        sender_id: user!.id,
        content: input.content ?? null,
        media_urls: input.mediaUrls ?? null,
        media_types: input.mediaTypes ?? null,
        reply_to_message_id: input.replyToMessageId ?? null,
        message_type: input.messageType ?? 'text',
        system_data: null,
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        created_at: new Date().toISOString(),
        sender_name: 'You',
        sender_avatar: null,
        reactions: [],
        _optimistic: true,
      };

      // Prepend to first page (newest messages)
      queryClient.setQueryData(messagesKey, (old: any) => {
        if (!old?.pages) {
          return { pages: [[optimisticMsg]], pageParams: [0] };
        }
        const newPages = [...old.pages];
        newPages[0] = [optimisticMsg, ...newPages[0]];
        return { ...old, pages: newPages };
      });

      return { messagesKey, optimisticId };
    },
    onSuccess: (serverMsg, _input, context) => {
      if (!context) return;
      // Atomically replace the optimistic message with the real server row.
      // No disappear → reappear; the swap is a single setQueryData call.
      queryClient.setQueryData(context.messagesKey, (old: any) => {
        if (!old?.pages) return old;
        const pages = old.pages.map((page: ChatMessage[]) =>
          page.map((m) =>
            m.id === context.optimisticId
              ? {
                  ...serverMsg,
                  system_data: serverMsg.system_data as Record<string, unknown> | null,
                  sender_name: 'You',
                  sender_avatar: null,
                  reactions: [],
                  reply_to: m.reply_to ?? null,
                  _optimistic: false,
                }
              : m
          )
        );
        return { ...old, pages };
      });
    },
    onError: (_err, _input, context) => {
      if (context?.messagesKey) {
        // Remove optimistic message on error
        queryClient.setQueryData(context.messagesKey, (old: any) => {
          if (!old?.pages) return old;
          const pages = old.pages.map((page: ChatMessage[]) =>
            page.filter((m) => !m._optimistic)
          );
          return { ...old, pages };
        });
      }
    },
    onSettled: (_data, _error, input) => {
      // Only refresh conversation list for last-message preview — NOT messages.
      // Messages are already correct from onSuccess (optimistic → real swap).
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
      });
    },
  });
}

// ─── useCreateConversation ────────────────────────────────────────

export function useCreateConversation() {
  const { user, communityId } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const { data, error } = await supabase.rpc(
        'find_or_create_direct_conversation',
        {
          p_community_id: communityId!,
          p_user_id1: user!.id,
          p_user_id2: otherUserId,
        }
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
      });
    },
  });
}

// ─── useCreateGroupConversation ───────────────────────────────────

interface CreateGroupInput {
  name: string;
  description?: string;
  memberUserIds: string[];
}

export function useCreateGroupConversation() {
  const { communityId, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateGroupInput) => {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        p_community_id: communityId!,
        p_name: input.name,
        p_description: input.description ?? null,
        p_member_user_ids: input.memberUserIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
      });
    },
  });
}

// ─── useTypingIndicator ───────────────────────────────────────────

interface TypingUser {
  userId: string;
  name: string;
}

export function useTypingIndicator(conversationId: string | undefined) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !user?.id) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ name: string; typing: boolean }>();
        const typing: TypingUser[] = [];
        for (const [userId, presences] of Object.entries(state)) {
          if (userId === user.id) continue;
          const latest = presences[presences.length - 1];
          if (latest?.typing) {
            typing.push({ userId, name: latest.name ?? 'Someone' });
          }
        }
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ typing: false, name: '' });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [conversationId, user?.id]);

  const sendTyping = useCallback(
    (name: string) => {
      if (!channelRef.current) return;

      channelRef.current.track({ typing: true, name });

      // Auto-stop after 3s
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        channelRef.current?.track({ typing: false, name });
      }, 3000);
    },
    []
  );

  const stopTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.track({ typing: false, name: '' });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { typingUsers, sendTyping, stopTyping };
}

// ─── useMarkAsRead ────────────────────────────────────────────────

export function useMarkAsRead(conversationId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const markRead = useCallback(
    async (upToMessageId: string) => {
      if (!conversationId || !user?.id) return;

      await supabase.rpc('mark_messages_read', {
        p_conversation_id: conversationId,
        p_user_id: user.id,
        p_up_to_message_id: upToMessageId,
      });

      // Refresh unread count and conversation list
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.unreadCount(user.id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user.id).queryKey,
      });
    },
    [conversationId, user?.id, queryClient]
  );

  return { markRead };
}

// ─── useMessageActions ────────────────────────────────────────────

export function useMessageActions(conversationId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const editMessage = useMutation({
    mutationFn: async ({
      messageId,
      newContent,
    }: {
      messageId: string;
      newContent: string;
    }) => {
      const { data, error } = await supabase.rpc('edit_message', {
        p_message_id: messageId,
        p_new_content: newContent,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId).queryKey,
      });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { data, error } = await supabase.rpc('delete_message', {
        p_message_id: messageId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
      });
    },
  });

  const toggleReaction = useMutation({
    mutationFn: async ({
      messageId,
      reaction,
    }: {
      messageId: string;
      reaction: string;
    }) => {
      // Check if reaction exists
      const { data: existing } = await supabase
        .from('message_reactions')
        .select('id')
        .eq('message_id', messageId)
        .eq('user_id', user!.id)
        .eq('reaction', reaction)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('message_reactions').insert({
          message_id: messageId,
          user_id: user!.id,
          reaction,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.messages(conversationId).queryKey,
      });
    },
  });

  return { editMessage, deleteMessage, toggleReaction };
}

// ─── useSearchMessages ────────────────────────────────────────────

export function useSearchMessages(searchQuery: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.conversations.search(user?.id ?? '', searchQuery).queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_messages', {
        p_user_id: user!.id,
        p_query: searchQuery,
        p_limit: 20,
      });
      if (error) throw error;
      return (data ?? []) as SearchMessageResult[];
    },
    enabled: !!user?.id && searchQuery.length >= 2,
  });
}

// ─── useChatPresence ──────────────────────────────────────────────

export function useChatPresence(communityId: string | undefined) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!communityId || !user?.id) return;

    const channel = supabase.channel(`online:${communityId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [communityId, user?.id]);

  return { onlineUsers };
}

// ─── useUnreadConversations ───────────────────────────────────────

export function useUnreadConversations() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.conversations.unreadCount(user?.id ?? '').queryKey,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        'get_unread_conversations_count',
        { p_user_id: user!.id }
      );
      if (error) throw error;
      return (data ?? 0) as number;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Poll every 30s as backup
  });
}

// ─── useMuteConversation ──────────────────────────────────────────

export function useMuteConversation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      mute,
    }: {
      conversationId: string;
      mute: boolean;
    }) => {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ is_muted: mute })
        .eq('conversation_id', conversationId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.list(user?.id ?? '').queryKey,
      });
    },
  });
}
