import * as Location from 'expo-location';
import * as SMS from 'expo-sms';

// Request location permission and get current coords
export async function getCurrentLocation() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('Location permission denied');
  }
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return location.coords; // { latitude, longitude }
}

// Watch location in real-time (returns a subscription to stop later)
export async function watchLocation(callback) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    (loc) => callback(loc.coords)
  );
  return sub;
}

// Send SOS SMS to all emergency contacts
export async function sendSOSMessages(contacts, coords) {
  if (!contacts || contacts.length === 0) return false;

  const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  const message =
    `🚨 SOS ALERT 🚨\n` +
    `I need help! This is my current location:\n${mapsLink}\n` +
    `Please call me or contact emergency services immediately.`;

  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return false;

  const phoneNumbers = contacts.map((c) => c.phone);
  const { result } = await SMS.sendSMSAsync(phoneNumbers, message);
  return result === 'sent';
}

// Make an emergency call (opens phone dialer)
export function callEmergency(number = '112') {
  const { Linking } = require('react-native');
  Linking.openURL(`tel:${number}`);
}