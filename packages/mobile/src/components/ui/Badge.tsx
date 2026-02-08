import { View, Text } from 'react-native';

interface BadgeVariant {
  bg: string;
  text: string;
  label: string;
}

const DEFAULT_VARIANTS: Record<string, BadgeVariant> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pendiente' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Aprobado' },
  rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rechazado' },
  active: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Activo' },
  expired: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Expirado' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Cancelado' },
};

interface StatusBadgeProps {
  status: string;
  variants?: Record<string, BadgeVariant>;
}

export function StatusBadge({ status, variants }: StatusBadgeProps) {
  const map = variants ?? DEFAULT_VARIANTS;
  const variant = map[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: status,
  };

  return (
    <View className={`${variant.bg} rounded-full px-2 py-0.5 self-start`}>
      <Text className={`${variant.text} text-xs font-medium`}>{variant.label}</Text>
    </View>
  );
}
