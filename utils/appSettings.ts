import AsyncStorage from "@react-native-async-storage/async-storage";

export interface AppFeedbackSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

export async function getFeedbackSettings(): Promise<AppFeedbackSettings> {
  try {
    const raw = await AsyncStorage.getItem("settings");
    const settings = raw ? JSON.parse(raw) : {};
    return {
      notificationsEnabled: settings.notificationsEnabled !== false,
      soundEnabled: settings.soundEnabled !== false,
    };
  } catch {
    return { notificationsEnabled: true, soundEnabled: true };
  }
}

export async function isSoundEnabled(): Promise<boolean> {
  return (await getFeedbackSettings()).soundEnabled;
}

export async function areNotificationsEnabled(): Promise<boolean> {
  return (await getFeedbackSettings()).notificationsEnabled;
}
