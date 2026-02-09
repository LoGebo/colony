import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  Animated,
} from 'react-native';

// ---------- Types ----------

interface EmergencyTypeOption {
  type: string;
  label: string;
  icon: string;
  bgColor: string;
  textColor: string;
}

interface EmergencyTypeSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectType: (type: string) => Promise<void>;
}

// ---------- Emergency type options ----------

const EMERGENCY_TYPES: EmergencyTypeOption[] = [
  {
    type: 'panic',
    label: 'Panico',
    icon: '🛡️',
    bgColor: 'bg-red-500',
    textColor: 'text-white',
  },
  {
    type: 'medical',
    label: 'Medica',
    icon: '🏥',
    bgColor: 'bg-blue-500',
    textColor: 'text-white',
  },
  {
    type: 'fire',
    label: 'Incendio',
    icon: '🔥',
    bgColor: 'bg-orange-500',
    textColor: 'text-white',
  },
  {
    type: 'intrusion',
    label: 'Intrusion',
    icon: '🚨',
    bgColor: 'bg-purple-500',
    textColor: 'text-white',
  },
];

// ---------- Component ----------

function EmergencyTypeSheetInner({
  visible,
  onClose,
  onSelectType,
}: EmergencyTypeSheetProps) {
  const [sending, setSending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animate in when visible
  useEffect(() => {
    if (visible) {
      setSending(false);
      setConfirmed(false);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }

    return () => {
      if (confirmTimer.current) {
        clearTimeout(confirmTimer.current);
        confirmTimer.current = null;
      }
    };
  }, [visible, fadeAnim]);

  const handleSelect = useCallback(
    async (type: string) => {
      if (sending || confirmed) return;
      setSending(true);

      try {
        await onSelectType(type);
        setConfirmed(true);

        // Auto-close after 2 seconds of confirmation
        confirmTimer.current = setTimeout(() => {
          setConfirmed(false);
          setSending(false);
          onClose();
        }, 2000);
      } catch {
        setSending(false);
      }
    },
    [sending, confirmed, onSelectType, onClose]
  );

  const handleCancel = useCallback(() => {
    if (sending) return;
    onClose();
  }, [sending, onClose]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={handleCancel}
    >
      <Animated.View
        style={{ flex: 1, opacity: fadeAnim }}
        className="bg-black/50 justify-end"
      >
        {/* Tap outside to cancel */}
        <Pressable className="flex-1" onPress={handleCancel} />

        {/* Bottom card */}
        <View className="bg-white rounded-t-2xl px-5 pt-6 pb-8">
          {confirmed ? (
            // Confirmation view
            <View className="items-center py-8">
              <Text className="text-5xl mb-4">{'✅'}</Text>
              <Text className="text-xl font-bold text-green-700">
                Alerta enviada
              </Text>
              <Text className="text-sm text-gray-500 mt-2">
                Se notifico a todo el equipo de seguridad
              </Text>
            </View>
          ) : (
            <>
              {/* Header */}
              <Text className="text-xl font-bold text-gray-900 text-center mb-1">
                Tipo de Emergencia
              </Text>
              <Text className="text-sm text-gray-500 text-center mb-5">
                Selecciona el tipo de alerta a enviar
              </Text>

              {/* Type tiles -- 2x2 grid */}
              <View className="flex-row flex-wrap gap-3 mb-5">
                {EMERGENCY_TYPES.map((option) => (
                  <Pressable
                    key={option.type}
                    onPress={() => handleSelect(option.type)}
                    disabled={sending}
                    className={`${option.bgColor} rounded-xl p-4 items-center justify-center active:opacity-80`}
                    style={{ width: '47%' }}
                  >
                    <Text className="text-3xl mb-2">{option.icon}</Text>
                    <Text
                      className={`${option.textColor} text-base font-bold`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Cancel button */}
              <Pressable
                onPress={handleCancel}
                disabled={sending}
                className="bg-gray-100 rounded-xl py-3.5 items-center active:bg-gray-200"
              >
                <Text className="text-gray-700 font-semibold text-base">
                  Cancelar
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

export const EmergencyTypeSheet = React.memo(EmergencyTypeSheetInner);
