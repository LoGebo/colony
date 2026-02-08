import { Pressable, View, Text, type ViewProps } from 'react-native';

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle?: string;
  onPress: () => void;
  color?: string;
}

export function DashboardCard({
  title,
  value,
  subtitle,
  onPress,
  color = 'bg-blue-50',
}: DashboardCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`${color} rounded-xl p-4 mb-3 active:opacity-80`}
    >
      <Text className="text-sm text-gray-600">{title}</Text>
      <Text className="text-2xl font-bold text-gray-900">{value}</Text>
      {subtitle ? (
        <Text className="text-xs text-gray-500 mt-1">{subtitle}</Text>
      ) : null}
    </Pressable>
  );
}

interface SectionCardProps extends ViewProps {
  children: React.ReactNode;
}

export function SectionCard({ children, className, ...props }: SectionCardProps) {
  return (
    <View className={`bg-white rounded-xl p-4 shadow-sm ${className ?? ''}`} {...props}>
      {children}
    </View>
  );
}
