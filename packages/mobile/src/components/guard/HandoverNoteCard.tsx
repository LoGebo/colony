import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { formatRelative } from '@/lib/dates';

interface PendingItem {
  description: string;
  completed: boolean;
}

interface HandoverNoteCardProps {
  guardName: string;
  notes: string;
  priority: string;
  pendingItems: PendingItem[];
  createdAt: string;
  acknowledged: boolean;
  onAcknowledge?: () => void;
}

const PRIORITY_COLORS: Record<string, { accent: string; bg: string; text: string; label: string }> = {
  normal: { accent: 'border-l-gray-300', bg: 'bg-gray-50', text: 'text-gray-600', label: 'Normal' },
  important: { accent: 'border-l-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700', label: 'Importante' },
  urgent: { accent: 'border-l-red-500', bg: 'bg-red-50', text: 'text-red-700', label: 'Urgente' },
};

function HandoverNoteCardInner({
  guardName,
  notes,
  priority,
  pendingItems,
  createdAt,
  acknowledged,
  onAcknowledge,
}: HandoverNoteCardProps) {
  const colors = PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.normal;

  return (
    <View
      className={`bg-white rounded-xl mb-3 shadow-sm border-l-4 ${colors.accent} overflow-hidden`}
    >
      <View className="p-4">
        {/* Header: guard name + priority + time */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2 flex-1">
            <Text className="text-base font-semibold text-gray-900" numberOfLines={1}>
              {guardName}
            </Text>
            {priority !== 'normal' ? (
              <View className={`${colors.bg} rounded-full px-2 py-0.5`}>
                <Text className={`${colors.text} text-xs font-medium`}>
                  {colors.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-xs text-gray-400 ml-2">
            {formatRelative(createdAt)}
          </Text>
        </View>

        {/* Notes */}
        <Text className="text-sm text-gray-700 leading-5 mb-2">{notes}</Text>

        {/* Pending items checklist */}
        {pendingItems.length > 0 ? (
          <View className="mt-1">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Pendientes
            </Text>
            {pendingItems.map((item, index) => (
              <View key={index} className="flex-row items-start py-1">
                <Text className="text-sm mr-2">
                  {item.completed ? '\u2611' : '\u2610'}
                </Text>
                <Text
                  className={`text-sm flex-1 ${
                    item.completed
                      ? 'text-gray-400 line-through'
                      : 'text-gray-700'
                  }`}
                >
                  {item.description}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Acknowledge button */}
        {!acknowledged && onAcknowledge ? (
          <Pressable
            onPress={onAcknowledge}
            className="bg-blue-600 rounded-lg py-2 mt-3 items-center active:opacity-80"
          >
            <Text className="text-white font-semibold text-sm">
              Confirmar Lectura
            </Text>
          </Pressable>
        ) : null}

        {/* Acknowledged indicator */}
        {acknowledged ? (
          <View className="flex-row items-center mt-2">
            <Text className="text-xs text-green-600 font-medium">
              Confirmado
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const HandoverNoteCard = React.memo(HandoverNoteCardInner);
