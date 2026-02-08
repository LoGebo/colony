import React from 'react';
import { View, Text } from 'react-native';
import { formatTime } from '@/lib/dates';

const METHOD_LABELS: Record<string, string> = {
  qr_scan: 'QR',
  manual: 'Manual',
  nfc: 'NFC',
  lpr: 'Placas',
  remote: 'Remoto',
};

const DECISION_VARIANTS: Record<string, { bg: string; text: string; label: string }> = {
  allowed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Permitido' },
  denied: { bg: 'bg-red-100', text: 'text-red-800', label: 'Denegado' },
  blocked: { bg: 'bg-red-200', text: 'text-red-900', label: 'Bloqueado' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
};

interface AccessLogRowProps {
  log: {
    id: string;
    person_name: string;
    person_type: string;
    direction: string;
    method: string;
    decision: string;
    logged_at: string;
    plate_number: string | null;
    guard_notes: string | null;
    photo_url: string | null;
  };
}

function AccessLogRowInner({ log }: AccessLogRowProps) {
  const isEntry = log.direction === 'entry';
  const decisionVariant = DECISION_VARIANTS[log.decision] ?? DECISION_VARIANTS.pending;

  return (
    <View className="bg-white px-4 py-3 border-b border-gray-100 flex-row items-center">
      {/* Direction indicator */}
      <View className="mr-3 items-center w-14">
        <Text
          className={`text-xs font-semibold ${
            isEntry ? 'text-green-600' : 'text-blue-600'
          }`}
        >
          {isEntry ? 'Entrada' : 'Salida'}
        </Text>
      </View>

      {/* Person info */}
      <View className="flex-1 mr-2">
        <Text className="text-sm font-medium text-gray-900" numberOfLines={1}>
          {log.person_name}
        </Text>
        <Text className="text-xs text-gray-500">
          {METHOD_LABELS[log.method] ?? log.method}
          {log.plate_number ? ` - ${log.plate_number}` : ''}
        </Text>
      </View>

      {/* Time and decision */}
      <View className="items-end">
        <Text className="text-xs text-gray-400 mb-1">
          {formatTime(log.logged_at)}
        </Text>
        <View className={`${decisionVariant.bg} rounded-full px-2 py-0.5`}>
          <Text className={`${decisionVariant.text} text-xs font-medium`}>
            {decisionVariant.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

export const AccessLogRow = React.memo(AccessLogRowInner);
