import React, { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  Animated,
  Alert,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTriggerEmergency } from '@/hooks/useEmergency';
import { EmergencyTypeSheet } from './EmergencyTypeSheet';

/**
 * Persistent floating panic button for guard emergency alerts.
 * Rendered in the guard _layout.tsx outside Tabs, absolute positioned.
 *
 * - Short press: shows tooltip instructing to hold for 2 seconds
 * - Long press (2000ms): haptic feedback + opens EmergencyTypeSheet
 * - Pulsing animation during press-in
 */
function PanicButtonInner() {
  const [sheetVisible, setSheetVisible] = useState(false);
  const triggerEmergency = useTriggerEmergency();

  // Animation for pulsing during press
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = useCallback(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 400,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current = animation;
    animation.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  const handlePress = useCallback(() => {
    // Short press -- show tooltip
    Alert.alert(
      'Boton de Panico',
      'Manten presionado 2 segundos para activar la alerta de emergencia.',
      [{ text: 'Entendido' }]
    );
  }, []);

  const handleLongPress = useCallback(async () => {
    stopPulse();
    // Haptic feedback on successful long-press
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {
      // Haptics may not be available in simulator
    }
    setSheetVisible(true);
  }, [stopPulse]);

  const handleSelectType = useCallback(
    async (emergencyType: string) => {
      try {
        await triggerEmergency.mutateAsync({
          emergency_type: emergencyType,
        });
      } catch {
        Alert.alert('Error', 'No se pudo enviar la alerta. Intenta de nuevo.');
      }
    },
    [triggerEmergency]
  );

  return (
    <>
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 90,
          right: 16,
          zIndex: 999,
          transform: [{ scale: pulseAnim }],
        }}
      >
        <Pressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          delayLongPress={2000}
          onPressIn={startPulse}
          onPressOut={stopPulse}
          className="w-16 h-16 bg-red-600 rounded-full items-center justify-center shadow-lg"
          style={{
            elevation: 8,
            shadowColor: '#dc2626',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
          }}
        >
          <Text className="text-white text-lg font-black tracking-wider">
            SOS
          </Text>
        </Pressable>
      </Animated.View>

      <EmergencyTypeSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSelectType={handleSelectType}
      />
    </>
  );
}

export const PanicButton = React.memo(PanicButtonInner);
