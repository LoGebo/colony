import React from 'react';
import { View, Text } from 'react-native';

interface BlacklistAlertProps {
  blacklistResult: {
    is_blocked: boolean;
    blacklist_id?: string;
    reason?: string;
    protocol?: string;
  };
}

function BlacklistAlertInner({ blacklistResult }: BlacklistAlertProps) {
  if (!blacklistResult.is_blocked) {
    return null;
  }

  return (
    <View className="bg-red-600 rounded-xl p-4 mb-4 border-2 border-red-800">
      <View className="flex-row items-center mb-2">
        <Text className="text-xl mr-2">{'!!'}</Text>
        <Text className="text-white font-bold text-lg flex-1">
          ALERTA DE LISTA NEGRA
        </Text>
      </View>

      {blacklistResult.reason ? (
        <Text className="text-white text-sm mb-2">
          Motivo: {blacklistResult.reason}
        </Text>
      ) : null}

      {blacklistResult.protocol ? (
        <Text className="text-red-100 text-sm">
          Protocolo: {blacklistResult.protocol}
        </Text>
      ) : (
        <Text className="text-red-100 text-sm">
          Protocolo: Denegar entrada y notificar a administracion
        </Text>
      )}
    </View>
  );
}

export const BlacklistAlert = React.memo(BlacklistAlertInner);
