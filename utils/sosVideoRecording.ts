import AsyncStorage from "@react-native-async-storage/async-storage";
import { Camera, CameraView, type CameraRecordingOptions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

const STORAGE_KEY = "sos_recordings";

let cameraRef: InstanceType<typeof CameraView> | null = null;
let isVideoRecording = false;

/**
 * Call with a mounted CameraView (see SOS alert screen) or null on unmount.
 */
export function setSOSCameraRef(ref: InstanceType<typeof CameraView> | null) {
  cameraRef = ref;
}

/**
 * Camera + microphone are required. Media library is optional (save to gallery only).
 */
export async function requestVideoPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
  const { status: micStatus } = await Camera.requestMicrophonePermissionsAsync();
  if (camStatus !== "granted" || micStatus !== "granted") return false;

  try {
    await MediaLibrary.requestPermissionsAsync();
  } catch {
    /* saving to camera roll is optional */
  }

  return true;
}

async function persistVideoEntry(uri: string) {
  try {
    const entry = {
      id: Date.now().toString(),
      uri,
      type: "video" as const,
      duration: 0,
      triggeredAt: new Date().toISOString(),
      sizeBytes: 0,
    };
    const existing = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? "[]");
    const updated = [entry, ...existing];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    console.log(`[SOS Video] Persisted video entry. ID: ${entry.id}, URI: ${uri}`);
  } catch (e) {
    console.error("[SOS Video] Failed to persist video entry:", e);
  }
}

/**
 * Start recording video via the camera ref.
 * Returns "recording_started" on success, null on failure.
 */
export async function startSOSVideoRecording(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!cameraRef) {
    console.warn("SOS Video Recording: No camera ref available");
    return null;
  }
  if (isVideoRecording) return "recording_started";

  try {
    const granted = await requestVideoPermissions();
    if (!granted) {
      console.warn("SOS Video Recording: Permissions not granted");
      return null;
    }

    isVideoRecording = true;

    const options: CameraRecordingOptions = {
      maxDuration: 300,
    };

    cameraRef
      .recordAsync(options)
      .then(async (video: { uri: string } | undefined) => {
        if (video?.uri) {
          console.log("SOS Video Recording: Saved video to", video.uri);
          await persistVideoEntry(video.uri);
          try {
            await MediaLibrary.saveToLibraryAsync(video.uri);
            console.log("SOS Video Recording: Saved to gallery");
          } catch (e) {
            console.warn("SOS Video Recording: Gallery save failed", e);
            /* gallery save optional */
          }
        } else {
          console.warn("SOS Video Recording: No video URI returned");
        }
        isVideoRecording = false;
      })
      .catch((e) => {
        console.warn("SOS Video Recording: recordAsync failed:", e);
        isVideoRecording = false;
      });

    console.log("SOS Video Recording: Started successfully");
    return "recording_started";
  } catch (e) {
    console.warn("SOS Video Recording failed to start:", e);
    isVideoRecording = false;
    return null;
  }
}

/**
 * Stop the active video recording.
 */
export async function stopSOSVideoRecording(): Promise<void> {
  try {
    if (cameraRef && isVideoRecording) {
      console.log("SOS Video Recording: Stopping...");
      cameraRef.stopRecording();
      isVideoRecording = false;
      console.log("SOS Video Recording: Stopped");
    } else if (!isVideoRecording) {
      console.log("SOS Video Recording: Not actively recording");
    } else {
      console.warn("SOS Video Recording: No camera ref available");
    }
  } catch (e) {
    console.warn("SOS Video Recording failed to stop:", e);
    isVideoRecording = false;
  }
}

export function isVideoRecordingActive(): boolean {
  return isVideoRecording;
}
