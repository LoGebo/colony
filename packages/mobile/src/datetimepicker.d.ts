declare module '@react-native-community/datetimepicker' {
  import { Component } from 'react';

  export interface DateTimePickerEvent {
    type: string;
    nativeEvent: {
      timestamp: number;
      utcOffset: number;
    };
  }

  export interface DateTimePickerProps {
    value: Date;
    mode?: 'date' | 'time' | 'datetime';
    display?: 'default' | 'spinner' | 'calendar' | 'clock' | 'compact' | 'inline';
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
    maximumDate?: Date;
    minimumDate?: Date;
    is24Hour?: boolean;
    minuteInterval?: 1 | 2 | 3 | 4 | 5 | 6 | 10 | 12 | 15 | 20 | 30;
    locale?: string;
    textColor?: string;
    accentColor?: string;
    themeVariant?: 'dark' | 'light';
    style?: any;
    testID?: string;
  }

  export default class DateTimePicker extends Component<DateTimePickerProps> {}
}
