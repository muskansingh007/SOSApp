import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import { Linking, Platform } from "react-native";

// ─── Location ────────────────────────────────────────────────────────────────

export async function getCurrentLocation() {
  if (Platform.OS === "web") throw new Error("Location not supported on web");
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Location permission denied");
  const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
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

// ─── SMS ─────────────────────────────────────────────────────────────────────

export async function sendSOSMessages(
  contacts: { name: string; phone: string }[],
  coords: { latitude: number; longitude: number },
  customMessage?: string
): Promise<boolean> {
  if (!contacts || contacts.length === 0) return false;
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) return false;
  const mapsLink = `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;
  const message  = customMessage ||
    `🚨 SOS ALERT 🚨\nI need help! This is my current location:\n${mapsLink}\nPlease call me or contact emergency services immediately.`;
  const { result } = await SMS.sendSMSAsync(contacts.map((c) => c.phone), message);
  return result === "sent";
}

// ─── Calling ─────────────────────────────────────────────────────────────────

export function createSequentialCaller(
  contacts: { name: string; phone: string }[],
  emergencyNumber = "112"
) {
  let index = 0;
  function callNext() {
    if (index < contacts.length) {
      const contact = contacts[index++];
      Linking.openURL(`tel:${contact.phone}`);
      return { contact, remaining: contacts.length - index, done: false };
    }
    Linking.openURL(`tel:${emergencyNumber}`);
    return { contact: null, remaining: 0, done: true };
  }
  return {
    callNext,
    callEmergencyDirect: () => Linking.openURL(`tel:${emergencyNumber}`),
  };
}

export function callEmergency(number = "112") {
  Linking.openURL(`tel:${number}`);
}

// ─── Audio Recording ──────────────────────────────────────────────────────────
// How it works:
// 1. startSOSRecording() begins recording and saves a placeholder entry
//    with uri="__pending__" to AsyncStorage immediately.
// 2. stopSOSRecording() stops the recording, gets the real file URI,
//    then updates the placeholder entry with the real URI.
// This ensures the Recordings gallery always has a valid entry.

let recordingRef:      Audio.Recording | null = null;
let pendingRecordingId: string | null          = null;

export async function startSOSRecording(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return false;

    const { status } = await Audio.requestPermissionsAsync();
    if (status !== "granted") return false;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef = recording;

    // Save placeholder — will be updated with real URI when recording stops
    const id = Date.now().toString();
    pendingRecordingId = id;
    const entry = {
      id,
      uri:         "__pending__",
      type:        "audio",
      duration:    0,
      triggeredAt: new Date().toISOString(),
      sizeBytes:   0,
    };
    const existing = JSON.parse((await AsyncStorage.getItem("sos_recordings")) ?? "[]");
    await AsyncStorage.setItem("sos_recordings", JSON.stringify([entry, ...existing]));

    return true;
  } catch (e) {
    console.warn("SOS Recording failed to start:", e);
    return false;
  }
}

export async function stopSOSRecording(): Promise<string | null> {
  try {
    if (!recordingRef) return null;

    await recordingRef.stopAndUnloadAsync();
    const uri = recordingRef.getURI();
    recordingRef = null;

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

    // Update the placeholder entry with the real file URI
    if (uri && pendingRecordingId) {
      const existing = JSON.parse((await AsyncStorage.getItem("sos_recordings")) ?? "[]");
      const updated  = existing.map((r: any) =>
        r.id === pendingRecordingId ? { ...r, uri } : r
      );
      await AsyncStorage.setItem("sos_recordings", JSON.stringify(updated));
      pendingRecordingId = null;
    }

    return uri ?? null;
  } catch (e) {
    console.warn("SOS Recording failed to stop:", e);
    return null;
  }
}

export function isRecording(): boolean {
  return recordingRef !== null;
}