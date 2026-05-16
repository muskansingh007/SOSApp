// Notification helper functions for SOS alerts
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { areNotificationsEnabled, getFeedbackSettings } from './appSettings';

async function shouldNotify() {
  return areNotificationsEnabled();
}

/**
 * Register device for push notifications and store token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (!(await shouldNotify())) return null;
  // Skip push token registration in Expo Go as remote notifications are not supported
  if (Constants.executionEnvironment === 'storeClient') {
    console.log('Skipping push token registration in Expo Go');
    return null;
  }

  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await AsyncStorage.setItem('pushToken', token);
    return token;
  } catch (e) {
    console.warn('Push notification registration failed:', e);
    return null;
  }
}

/**
 * Send SOS trigger notification
 */
export async function sendSOSTriggerNotification(
  coordsOrName: string | { latitude: number; longitude: number },
  timestamp?: string
): Promise<void> {
  if (!(await shouldNotify())) return;
  try {
    let body = 'Alert sent';
    
    if (typeof coordsOrName === 'string') {
      body = `Alert sent to ${coordsOrName}`;
      if (timestamp) body += ` at ${timestamp}`;
    } else if (typeof coordsOrName === 'object') {
      body = `SOS triggered at coordinates: ${coordsOrName.latitude}, ${coordsOrName.longitude}`;
    }
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS Triggered',
        body,
        sound: (await getFeedbackSettings()).soundEnabled ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to send SOS trigger notification:', e);
  }
}

/**
 * Send SMS sent confirmation notification
 */
export async function sendSMSSentNotification(recipientCount: number): Promise<void> {
  if (!(await shouldNotify())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SMS Sent',
        body: `Emergency message sent to ${recipientCount} contact(s)`,
        sound: (await getFeedbackSettings()).soundEnabled ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to send SMS notification:', e);
  }
}

/**
 * Send SOS cancelled notification
 */
export async function sendSOSCancelledNotification(): Promise<void> {
  if (!(await shouldNotify())) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS Cancelled',
        body: 'Emergency alert has been cancelled',
        sound: (await getFeedbackSettings()).soundEnabled ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to send cancelled notification:', e);
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (!(await shouldNotify())) return;
  const feedback = await getFeedbackSettings();
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: feedback.soundEnabled ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to send local notification:', e);
  }
}

/**
 * Cancel all location update notifications
 */
export async function cancelLocationUpdateNotifications(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (e) {
    console.warn('Failed to cancel notifications:', e);
  }
}
