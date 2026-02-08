import { View, Text } from 'react-native';

interface EmptyStateProps {
  message: string;
  icon?: string;
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <View className="items-center justify-center py-12">
      {icon ? <Text className="text-4xl mb-3">{icon}</Text> : null}
      <Text className="text-gray-400 text-center text-base px-8">{message}</Text>
    </View>
  );
}
