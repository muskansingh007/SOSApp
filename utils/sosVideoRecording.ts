import { Camera as CameraComponent, CameraRecordingOptions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

let cameraRef: any = null;
let isVideoRecording = false;

/**
 * Call this to give the recording module a reference to a mounted Camera.
 * Typically called from a hidden <Camera> component rendered during SOS active phase.
 */
export function setSOSCameraRef(ref: any) {
  cameraRef = ref;
}

/**
 * Request all permissions needed for video recording.
 * Returns true if all granted.
 */
export async function requestVideoPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  const { status: camStatus } = await CameraComponent.requestCameraPermissionsAsync();
  const { status: micStatus } = await CameraComponent.requestMicrophonePermissionsAsync();
  const { status: libStatus } = await MediaLibrary.requestPermissionsAsync();

  return camStatus === "granted" && micStatus === "granted" && libStatus === "granted";
}

/**
 * Start recording video via the camera ref.
 * Returns "recording_started" on success, null on failure.
 */
export async function startSOSVideoRecording(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  if (!cameraRef) return null;
  if (isVideoRecording) return "recording_started";

  try {
    const granted = await requestVideoPermissions();
    if (!granted) return null;

    isVideoRecording = true;

    const options: CameraRecordingOptions = {
      maxDuration: 300, // 5 minutes max
    };

    // recordAsync resolves when recording stops
    cameraRef.recordAsync(options).then(async (video: any) => {
      if (video?.uri) {
        // Save to device media library
        try {
          await MediaLibrary.saveToLibraryAsync(video.uri);
        } catch {}
      }
      isVideoRecording = false;
    }).catch(() => {
      isVideoRecording = false;
    });

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
      cameraRef.stopRecording();
    }
  } catch (e) {
    console.warn("SOS Video Recording failed to stop:", e);
  } finally {
    isVideoRecording = false;
  }
}

export function isVideoRecordingActive(): boolean {
  return isVideoRecording;
}