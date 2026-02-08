import React from 'react';
import { View, Text } from 'react-native';

interface PatrolProgressProps {
  checkpointsVisited: number;
  checkpointsTotal: number;
  status: string;
}

function PatrolProgressInner({
  checkpointsVisited,
  checkpointsTotal,
  status,
}: PatrolProgressProps) {
  const percentage =
    checkpointsTotal > 0
      ? Math.round((checkpointsVisited / checkpointsTotal) * 100)
      : 0;

  // Determine bar color and label based on status
  let barColor = 'bg-blue-600';
  let statusLabel: string | null = null;

  if (status === 'completed') {
    barColor = 'bg-green-600';
    statusLabel = 'Ronda completada';
  } else if (status === 'abandoned') {
    barColor = 'bg-red-600';
    statusLabel = 'Ronda abandonada';
  }

  return (
    <View className="mb-4">
      {/* Progress bar */}
      <View className="bg-gray-200 rounded-full h-3 overflow-hidden">
        <View
          className={`${barColor} rounded-full h-3`}
          style={{ width: `${percentage}%` }}
        />
      </View>

      {/* Text below */}
      <View className="flex-row items-center justify-between mt-1.5">
        <Text className="text-sm text-gray-600">
          {checkpointsVisited}/{checkpointsTotal} puntos de control
        </Text>
        <Text className="text-sm font-medium text-gray-700">{percentage}%</Text>
      </View>

      {/* Status label */}
      {statusLabel ? (
        <Text
          className={`text-sm font-semibold mt-1 ${
            status === 'completed' ? 'text-green-700' : 'text-red-700'
          }`}
        >
          {statusLabel}
        </Text>
      ) : null}
    </View>
  );
}

export const PatrolProgress = React.memo(PatrolProgressInner);
