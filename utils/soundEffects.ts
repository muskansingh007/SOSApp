import { isSoundEnabled } from "@/utils/appSettings";
import { Audio } from "expo-av";

type SoundEffect = "emergency" | "success";

const SOUND_SOURCES: Record<SoundEffect, number> = {
  emergency: require("@/assets/sounds/emergency-alarm.mp3"),
  success: require("@/assets/sounds/success-confirmation.wav"),
};

export async function playSoundEffect(effect: SoundEffect, volume = 1): Promise<void> {
  if (!(await isSoundEnabled())) return;

  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(SOUND_SOURCES[effect], {
      shouldPlay: true,
      volume,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch {
    // Sound feedback should never block safety flows.
  }
}

export function playEmergencySound(): Promise<void> {
  return playSoundEffect("emergency", 1);
}

export function playSuccessSound(): Promise<void> {
  return playSoundEffect("success", 0.85);
}
