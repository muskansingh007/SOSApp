// Notification helper functions for SOS alerts
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

/**
 * Register device for push notifications and store token
 */
export async function registerForPushNotifications(): Promise<string | null> {
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SMS Sent',
        body: `Emergency message sent to ${recipientCount} contact(s)`,
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
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SOS Cancelled',
        body: 'Emergency alert has been cancelled',
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to send cancelled notification:', e);
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
