import { Audio } from "expo-av";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";

// ─── Location ────────────────────────────────────────────────────────────────

export async function getCurrentLocation() {
  if (Platform.OS === "web") throw new Error("Location not supported on web");
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Location permission denied");
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return location.coords;
}

export async function watchLocation(callback: (coords: any) => void) {
  if (Platform.OS === "web") return null;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return null;
  return Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
    (loc) => callback(loc.coords)
  );
}

// ─── SMS (one-by-one to each contact) ────────────────────────────────────────

export async function sendSOSMessages(
  contacts: { name: string; phone: string }[],
  coords: { latitude: number; longitude: number },
  customMessage?: string
): Promise<boolean> {
  if (!contacts || contacts.length === 0) return false;
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return false;

  const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  const message =
    customMessage ||
    `🚨 SOS ALERT 🚨\nI need help! This is my current location:\n${mapsLink}\nPlease call me or contact emergency services immediately.`;

  // Send to all contacts at once (expo-sms opens composer once)
  const phoneNumbers = contacts.map((c) => c.phone);
  const { result } = await SMS.sendSMSAsync(phoneNumbers, message);
  return result === "sent";
}

// ─── Sequential Calling ───────────────────────────────────────────────────────

/**
 * Calls contacts one by one.
 * Returns a controller so the caller can advance to the next contact.
 */
export function createSequentialCaller(
  contacts: { name: string; phone: string }[],
  emergencyNumber: string = "112"
) {
  let index = 0;

  function callNext() {
    if (index < contacts.length) {
      const contact = contacts[index];
      index++;
      Linking.openURL(`tel:${contact.phone}`);
      return { contact, remaining: contacts.length - index, done: false };
    }
    // Fallback to emergency number when contacts exhausted
    Linking.openURL(`tel:${emergencyNumber}`);
    return { contact: null, remaining: 0, done: true };
  }

  function callEmergencyDirect() {
    Linking.openURL(`tel:${emergencyNumber}`);
  }

  return { callNext, callEmergencyDirect };
}

// ─── Emergency Call (direct) ──────────────────────────────────────────────────

export function callEmergency(number = "112") {
  Linking.openURL(`tel:${number}`);
}

// ─── Audio Recording ──────────────────────────────────────────────────────────

let recordingRef: Audio.Recording | null = null;

export async function startSOSRecording(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return null;

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") return null;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    await recording.startAsync();
    recordingRef = recording;
    return "recording_started";
  } catch (e) {
    console.warn("SOS Recording failed to start:", e);
    return null;
  }
}

export async function stopSOSRecording(): Promise<string | null> {
  try {
    if (!recordingRef) return null;
    await recordingRef.stopAndUnloadAsync();
    const uri = recordingRef.getURI();
    recordingRef = null;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    return uri ?? null;
  } catch (e) {
    console.warn("SOS Recording failed to stop:", e);
    return null;
  }
}

export function isRecording() {
  return recordingRef !== null;
}