import { useState, useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

type MarkedDates = Record<
  string,
  {
    marked?: boolean;
    dotColor?: string;
    selected?: boolean;
    selectedColor?: string;
  }
>;
import { useAmenityReservations, parseTstzrange } from '@/hooks/useReservations';
import { format } from 'date-fns';

interface AvailabilityCalendarProps {
  amenityId: string;
  selectedDate: string | null;
  onDateSelect: (date: string) => void;
}

export function AvailabilityCalendar({
  amenityId,
  selectedDate,
  onDateSelect,
}: AvailabilityCalendarProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [currentMonth, setCurrentMonth] = useState(
    () => format(new Date(), 'yyyy-MM')
  );

  const { data: reservations, isLoading } = useAmenityReservations(
    amenityId,
    currentMonth
  );

  // Build markedDates map from reservations
  const markedDates: MarkedDates = useMemo(() => {
    const marks: MarkedDates = {};

    // Count reservations per date
    const dateCounts: Record<string, number> = {};
    (reservations ?? []).forEach((r) => {
      try {
        const { start, end } = parseTstzrange(r.reserved_range as string);
        // Mark every day between start and end
        const current = new Date(start);
        while (current < end) {
          const dateKey = format(current, 'yyyy-MM-dd');
          dateCounts[dateKey] = (dateCounts[dateKey] ?? 0) + 1;
          current.setDate(current.getDate() + 1);
        }
      } catch {
        // Skip unparseable ranges
      }
    });

    // Mark dates with dots
    for (const [dateKey, count] of Object.entries(dateCounts)) {
      marks[dateKey] = {
        marked: true,
        dotColor: count >= 3 ? '#ef4444' : '#f97316', // red for busy, orange for some
      };
    }

    // Mark selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] ?? {}),
        selected: true,
        selectedColor: '#2563eb',
      };
    }

    return marks;
  }, [reservations, selectedDate]);

  const handleDayPress = useCallback(
    (day: DateData) => {
      // Only allow selecting today or future dates
      if (day.dateString >= today) {
        onDateSelect(day.dateString);
      }
    },
    [today, onDateSelect]
  );

  const handleMonthChange = useCallback((month: DateData) => {
    setCurrentMonth(`${month.year}-${String(month.month).padStart(2, '0')}`);
  }, []);

  return (
    <View className="bg-white rounded-xl overflow-hidden">
      <Calendar
        current={`${currentMonth}-01`}
        onDayPress={handleDayPress}
        onMonthChange={handleMonthChange}
        markedDates={markedDates}
        minDate={today}
        theme={{
          todayTextColor: '#2563eb',
          arrowColor: '#2563eb',
          selectedDayBackgroundColor: '#2563eb',
          selectedDayTextColor: '#ffffff',
          textDayFontSize: 14,
          textMonthFontSize: 16,
          textDayHeaderFontSize: 12,
          weekVerticalMargin: 4,
        }}
      />

      {isLoading ? (
        <View className="py-2 px-4">
          <Text className="text-xs text-gray-400 text-center">
            Cargando disponibilidad...
          </Text>
        </View>
      ) : null}

      {/* Legend */}
      <View className="flex-row items-center justify-center gap-4 py-2 px-4">
        <View className="flex-row items-center gap-1">
          <View className="w-2.5 h-2.5 rounded-full bg-orange-500" />
          <Text className="text-xs text-gray-500">Reservaciones</Text>
        </View>
        <View className="flex-row items-center gap-1">
          <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <Text className="text-xs text-gray-500">Alta demanda</Text>
        </View>
      </View>
    </View>
  );
}
