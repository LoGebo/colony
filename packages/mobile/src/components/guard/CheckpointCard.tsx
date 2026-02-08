import React from 'react';
import { View, Text } from 'react-native';
import { formatRelative } from '@/lib/dates';

interface CheckpointCardProps {
  name: string;
  description?: string;
  scanned: boolean;
  scannedAt?: string;
  gpsWithinTolerance?: boolean | null;
}

function CheckpointCardInner({
  name,
  description,
  scanned,
  scannedAt,
  gpsWithinTolerance,
}: CheckpointCardProps) {
  return (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm flex-row items-start">
      {/* Status indicator */}
      <View className="mr-3 mt-0.5">
        {scanned ? (
          <View className="w-6 h-6 rounded-full bg-green-500 items-center justify-center">
            <Text className="text-white text-xs font-bold">{'✓'}</Text>
          </View>
        ) : (
          <View className="w-6 h-6 rounded-full bg-gray-300" />
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text
          className={`text-base font-semibold ${
            scanned ? 'text-gray-900' : 'text-gray-500'
          }`}
        >
          {name}
        </Text>

        {description ? (
          <Text className="text-sm text-gray-500 mt-0.5">{description}</Text>
        ) : null}

        {/* Scanned details */}
        {scanned && scannedAt ? (
          <View className="flex-row items-center mt-2 gap-2">
            <Text className="text-xs text-gray-400">
              {formatRelative(scannedAt)}
            </Text>

            {/* GPS badge */}
            {gpsWithinTolerance === true ? (
              <View className="bg-green-100 rounded-md px-2 py-0.5">
                <Text className="text-xs text-green-700 font-medium">
                  GPS OK
                </Text>
              </View>
            ) : gpsWithinTolerance === null ||
              gpsWithinTolerance === undefined ? (
              <View className="bg-yellow-100 rounded-md px-2 py-0.5">
                <Text className="text-xs text-yellow-700 font-medium">
                  Sin GPS
                </Text>
              </View>
            ) : (
              <View className="bg-red-100 rounded-md px-2 py-0.5">
                <Text className="text-xs text-red-700 font-medium">
                  Fuera de rango
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const CheckpointCard = React.memo(CheckpointCardInner);
