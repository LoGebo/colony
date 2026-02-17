import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform alert that works on both native and web.
 * On web, Alert.alert is not available, so we fall back to window.confirm/alert.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS === 'web') {
    if (!buttons || buttons.length <= 1) {
      // Simple info alert
      window.alert(message ? `${title}\n\n${message}` : title);
      buttons?.[0]?.onPress?.();
    } else {
      // Confirmation dialog — last non-cancel button is the "confirm" action
      const cancelBtn = buttons.find((b) => b.style === 'cancel');
      const confirmBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];

      const confirmed = window.confirm(message ? `${title}\n\n${message}` : title);
      if (confirmed) {
        confirmBtn?.onPress?.();
      } else {
        cancelBtn?.onPress?.();
      }
    }
    return;
  }

  Alert.alert(title, message, buttons);
}
