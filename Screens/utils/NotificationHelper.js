import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure how notifications are presented when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─────────────────────────────────────────────
// Permission + token registration
// ─────────────────────────────────────────────

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.warn('Push notifications only work on a physical device.');
    return null;
  }

  // Check existing permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  // Ask if not granted
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission denied.');
    return null;
  }

  // Android needs a notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('sos-alerts', {
      name: 'SOS Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300, 200, 300],
      lightColor: '#D32F2F',
      sound: 'default',
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  // Get Expo push token (use your projectId from app.json if you have one)
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data; // e.g. "ExponentPushToken[xxxxxx]"
}

// ─────────────────────────────────────────────
// Local notifications (no server needed)
// ─────────────────────────────────────────────

// Fired immediately when SOS is triggered
export async function sendSOSTriggerNotification(coords) {
  const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚨 SOS ACTIVATED',
      body: `Your SOS alert is active. Contacting your emergency contacts now.\n📍 ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`,
      data: { type: 'sos_triggered', mapsLink },
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.MAX,
      channelId: 'sos-alerts',
      color: '#D32F2F',
    },
    trigger: null, // fire immediately
  });
}

// Confirmation once SMS has been sent
export async function sendSMSSentNotification(contactCount) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Contacts Notified',
      body: `SOS SMS sent to ${contactCount} emergency contact${contactCount !== 1 ? 's' : ''}.`,
      data: { type: 'sms_sent' },
      sound: 'default',
      channelId: 'sos-alerts',
    },
    trigger: null,
  });
}

// Periodic location update notification (every 2 min while SOS is active)
export async function scheduleLocationUpdateNotification(coords, intervalMinutes = 2) {
  // Cancel any previously scheduled location updates first
  await cancelLocationUpdateNotifications();

  const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  await Notifications.scheduleNotificationAsync({
    identifier: 'location-update',
    content: {
      title: '📍 SOS Location Update',
      body: `Your live location: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}\nTap to open map.`,
      data: { type: 'location_update', mapsLink },
      sound: null,
      channelId: 'sos-alerts',
    },
    trigger: {
      seconds: intervalMinutes * 60,
      repeats: true,
    },
  });
}

export async function cancelLocationUpdateNotifications() {
  await Notifications.cancelScheduledNotificationAsync('location-update').catch(() => {});
}

// "All clear" notification when SOS is cancelled
export async function sendSOSCancelledNotification() {
  await cancelLocationUpdateNotifications();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ SOS Cancelled',
      body: 'You have marked yourself as safe. SOS alert has been stopped.',
      data: { type: 'sos_cancelled' },
      sound: 'default',
      channelId: 'sos-alerts',
    },
    trigger: null,
  });
}

// ─────────────────────────────────────────────
// Notification tap handler (deep-link to Alert screen)
// ─────────────────────────────────────────────

export function setupNotificationResponseHandler(navigationRef) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const { type, mapsLink } = response.notification.request.content.data || {};
    if ((type === 'sos_triggered' || type === 'location_update') && navigationRef?.current) {
      // Navigate back to Alert screen if user taps the notification
      navigationRef.current.navigate('Alert');
    }
  });
  return sub; // call sub.remove() on cleanup
}

// ─────────────────────────────────────────────
// Foreground notification listener (optional logging)
// ─────────────────────────────────────────────
export function setupForegroundNotificationListener(callback) {
  const sub = Notifications.addNotificationReceivedListener((notification) => {
    if (callback) callback(notification);
  });
  return sub;
}