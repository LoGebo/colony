import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useAmenityReservations, parseTstzrange } from '@/hooks/useReservations';

interface TimeSlotPickerProps {
  amenityId: string;
  date: string; // yyyy-MM-dd
  onSlotSelect: (slot: { start: string; end: string }) => void;
}

interface SlotInfo {
  hour: number;
  label: string;
  isBooked: boolean;
}

const START_HOUR = 8;
const END_HOUR = 21;

export function TimeSlotPicker({
  amenityId,
  date,
  onSlotSelect,
}: TimeSlotPickerProps) {
  const month = date.substring(0, 7);
  const { data: reservations } = useAmenityReservations(amenityId, month);

  const [startHour, setStartHour] = useState<number | null>(null);
  const [endHour, setEndHour] = useState<number | null>(null);

  // Build slot availability for the selected date
  const slots: SlotInfo[] = useMemo(() => {
    const bookedHours = new Set<number>();

    (reservations ?? []).forEach((r) => {
      try {
        const { start, end } = parseTstzrange(r.reserved_range as string);
        const resDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;

        if (resDate === date) {
          // Mark all hours within this reservation as booked
          const startH = start.getHours();
          const endH = end.getHours() || 24; // midnight = 24
          for (let h = startH; h < endH; h++) {
            bookedHours.add(h);
          }
        }
      } catch {
        // Skip unparseable ranges
      }
    });

    const result: SlotInfo[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      result.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00 - ${String(h + 1).padStart(2, '0')}:00`,
        isBooked: bookedHours.has(h),
      });
    }
    return result;
  }, [reservations, date]);

  const handleSlotPress = useCallback(
    (hour: number) => {
      if (startHour === null) {
        // First selection: set start
        setStartHour(hour);
        setEndHour(hour + 1);
        // Emit initial selection
        const startISO = `${date}T${String(hour).padStart(2, '0')}:00:00`;
        const endISO = `${date}T${String(hour + 1).padStart(2, '0')}:00:00`;
        onSlotSelect({ start: startISO, end: endISO });
      } else if (hour >= startHour && hour < startHour + 1 && endHour === startHour + 1) {
        // Tapped same start slot: deselect
        setStartHour(null);
        setEndHour(null);
      } else if (hour >= startHour) {
        // Extend selection: set end to hour+1
        // Check all slots between startHour and hour are available
        let allAvailable = true;
        for (let h = startHour; h <= hour; h++) {
          if (slots.find((s) => s.hour === h)?.isBooked) {
            allAvailable = false;
            break;
          }
        }
        if (allAvailable) {
          setEndHour(hour + 1);
          const startISO = `${date}T${String(startHour).padStart(2, '0')}:00:00`;
          const endISO = `${date}T${String(hour + 1).padStart(2, '0')}:00:00`;
          onSlotSelect({ start: startISO, end: endISO });
        }
      } else {
        // Tapped before start: reset to new start
        setStartHour(hour);
        setEndHour(hour + 1);
        const startISO = `${date}T${String(hour).padStart(2, '0')}:00:00`;
        const endISO = `${date}T${String(hour + 1).padStart(2, '0')}:00:00`;
        onSlotSelect({ start: startISO, end: endISO });
      }
    },
    [startHour, endHour, date, onSlotSelect, slots]
  );

  const isSelected = (hour: number): boolean => {
    if (startHour === null || endHour === null) return false;
    return hour >= startHour && hour < endHour;
  };

  return (
    <View className="mt-3">
      <Text className="text-sm font-semibold text-gray-900 mb-2">
        Horarios disponibles
      </Text>
      <Text className="text-xs text-gray-500 mb-3">
        Selecciona la hora de inicio y extiende hasta la hora final
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
      >
        {slots.map((slot) => {
          const selected = isSelected(slot.hour);
          const booked = slot.isBooked;

          return (
            <Pressable
              key={slot.hour}
              onPress={() => !booked && handleSlotPress(slot.hour)}
              disabled={booked}
              className={`rounded-lg px-3 py-2 min-w-[100px] items-center ${
                booked
                  ? 'bg-gray-200'
                  : selected
                    ? 'bg-blue-600'
                    : 'bg-white border border-gray-300'
              }`}
            >
              <Text
                className={`text-xs font-medium ${
                  booked
                    ? 'text-gray-400'
                    : selected
                      ? 'text-white'
                      : 'text-gray-700'
                }`}
              >
                {slot.label}
              </Text>
              {booked ? (
                <Text className="text-xs text-gray-400 mt-0.5">Ocupado</Text>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {startHour !== null && endHour !== null ? (
        <View className="mt-3 bg-blue-50 rounded-lg p-3">
          <Text className="text-sm text-blue-800 font-medium">
            Seleccionado: {String(startHour).padStart(2, '0')}:00 -{' '}
            {String(endHour).padStart(2, '0')}:00 ({endHour - startHour}h)
          </Text>
        </View>
      ) : null}
    </View>
  );
}
