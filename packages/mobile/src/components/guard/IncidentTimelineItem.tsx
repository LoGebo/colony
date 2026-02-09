import React from 'react';
import { View, Text } from 'react-native';
import { formatDateTime } from '@/lib/dates';

interface TimelineEvent {
  type: string;
  timestamp: string;
  actor_name: string;
  data: Record<string, unknown>;
}

interface IncidentTimelineItemProps {
  event: TimelineEvent;
  isLast?: boolean;
}

const DOT_COLORS: Record<string, { bg: string; border: string }> = {
  created: { bg: 'bg-blue-500', border: 'border-blue-200' },
  status_changed: { bg: 'bg-orange-500', border: 'border-orange-200' },
  assigned: { bg: 'bg-purple-500', border: 'border-purple-200' },
  comment: { bg: 'bg-gray-400', border: 'border-gray-200' },
  media_added: { bg: 'bg-green-500', border: 'border-green-200' },
  escalated: { bg: 'bg-red-500', border: 'border-red-200' },
};

function getEventDescription(event: TimelineEvent): string {
  switch (event.type) {
    case 'created':
      return `Incidente reportado por ${event.actor_name}`;
    case 'status_changed': {
      const oldStatus = event.data.old_status
        ? ` (antes: ${event.data.old_status})`
        : '';
      return `Estado cambiado a ${event.data.new_status}${oldStatus}`;
    }
    case 'assigned':
      return `${event.actor_name} asignado`;
    case 'comment':
      return `${event.actor_name}: ${event.data.text ?? event.data.comment_text ?? ''}`;
    case 'media_added':
      return `Evidencia agregada por ${event.actor_name}`;
    case 'escalated':
      return `Escalado a ${event.data.new_priority} por ${event.actor_name}${event.data.reason ? `: ${event.data.reason}` : ''}`;
    default:
      return `${event.type}: ${event.actor_name}`;
  }
}

function IncidentTimelineItemInner({ event, isLast }: IncidentTimelineItemProps) {
  const colors = DOT_COLORS[event.type] ?? { bg: 'bg-gray-400', border: 'border-gray-200' };

  return (
    <View className="flex-row">
      {/* Timeline column: dot + line */}
      <View className="items-center mr-3" style={{ width: 24 }}>
        {/* Dot */}
        <View
          className={`w-3 h-3 rounded-full ${colors.bg} border-2 ${colors.border}`}
          style={{ marginTop: 4 }}
        />
        {/* Vertical line */}
        {!isLast ? (
          <View className="w-0.5 flex-1 bg-gray-200" style={{ minHeight: 24 }} />
        ) : null}
      </View>

      {/* Content */}
      <View className="flex-1 pb-4">
        <Text className="text-sm text-gray-800 leading-5">
          {getEventDescription(event)}
        </Text>
        <Text className="text-xs text-gray-400 mt-1">
          {formatDateTime(event.timestamp)}
        </Text>
      </View>
    </View>
  );
}

export const IncidentTimelineItem = React.memo(IncidentTimelineItemInner);
