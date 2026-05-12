import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Accelerometer } from "expo-sensors";
import { useEffect, useRef, useState } from "react";

interface Contact { name: string; phone: string; }

// Fixed threshold — shake sensitivity setting removed
const THRESHOLD       = 1.8;
const SHAKE_COOLDOWN  = 400;
const SHAKES_REQUIRED = 3;
const SHAKE_WINDOW    = 2000;
const SOS_COOLDOWN    = 8000;

// In Expo Go, shaking opens the dev menu — disable our listener there
const IS_EXPO_GO = Constants.executionEnvironment === "storeClient";

export function useShakeToSOS() {
  const router = useRouter();
  const [shakeCount, setShakeCount]         = useState(0);
  const [isShakeEnabled, setIsShakeEnabled] = useState(false);
  const [lastTriggered, setLastTriggered]   = useState(0);

  const shakeTimes      = useRef<number[]>([]);
  const lastShakeTime   = useRef(0);
  const lastSOSTime     = useRef(0);
  const subscriptionRef = useRef<any>(null);
  const enabledRef      = useRef(false);

  async function loadConfig() {
    try {
      const raw      = await AsyncStorage.getItem("settings");
      const settings = raw ? JSON.parse(raw) : {};

      const enabled =
        !IS_EXPO_GO && // Never enable in Expo Go — conflicts with the dev menu shake gesture
        (settings.sosTriggerMethod === "shake" ||
          settings.sosTriggerMethod === "both");

      enabledRef.current = enabled;
      setIsShakeEnabled(enabled);

      if (enabled) {
        startListening();
      } else {
        stopListening();
        setShakeCount(0);
        shakeTimes.current = [];
      }
    } catch {}
  }

  useEffect(() => {
    loadConfig();
    return () => stopListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startListening() {
    if (subscriptionRef.current) return; // already listening
    Accelerometer.setUpdateInterval(100);
    subscriptionRef.current = Accelerometer.addListener(({ x, y, z }) => {
      if (!enabledRef.current) return;
      const total = Math.sqrt(x * x + y * y + z * z);
      const now   = Date.now();

      if (total > THRESHOLD + 1 && now - lastShakeTime.current > SHAKE_COOLDOWN) {
        lastShakeTime.current = now;
        shakeTimes.current.push(now);
        shakeTimes.current = shakeTimes.current.filter((t) => now - t < SHAKE_WINDOW);

        const count = shakeTimes.current.length;
        setShakeCount(count);

        if (count >= SHAKES_REQUIRED && now - lastSOSTime.current > SOS_COOLDOWN) {
          lastSOSTime.current = now;
          shakeTimes.current  = [];
          setShakeCount(0);
          triggerShakeSOS();
        }
      }
    });
  }

  function stopListening() {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
  }

  async function triggerShakeSOS() {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLastTriggered(Date.now());

    const raw      = await AsyncStorage.getItem("contacts");
    const contacts: Contact[] = raw ? JSON.parse(raw) : [];

    if (contacts.length === 0) {
      router.push("/contacts");
      return;
    }

    router.push({
      pathname: "/alert",
      params: { contacts: JSON.stringify(contacts), triggeredBy: "shake" },
    });
  }

  return {
    isShakeEnabled,
    shakeCount,
    lastTriggered,
    refreshConfig: loadConfig,
  };
}