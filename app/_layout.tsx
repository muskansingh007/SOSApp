import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

import {
    ThemeProvider as AppThemeProvider,
    useTheme,
} from "@/context/ThemeContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { registerForPushNotifications, setupForegroundNotificationListener, setupNotificationResponseHandler } from "@/utils/NotificationHelper";

export const unstable_settings = {
  anchor: "(tabs)",
};

function LoadingScreen({ isVisible, onFinish }: { isVisible: boolean; onFinish: () => void }) {
  const { theme: C } = useTheme();

  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Animated.spring(logoScale, { toValue: 1, bounciness: 10, speed: 8, useNativeDriver: true }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1.14, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse2, { toValue: 1.1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse2, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, 500);

    setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse3, { toValue: 1.07, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse3, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    }, 1000);
  }, [fadeAnim, logoScale, pulse1, pulse2, pulse3]);

  useEffect(() => {
    function animateDot(dot: Animated.Value, delay: number) {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
          Animated.delay(800),
        ])
      ).start();
    }
    animateDot(dot1, 0);
    animateDot(dot2, 200);
    animateDot(dot3, 400);
  }, [dot1, dot2, dot3]);

  useEffect(() => {
    if (!isVisible) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        onFinish();
      });
    }
  }, [isVisible, fadeAnim, onFinish]);

  return (
    <Animated.View style={[styles.loadingRoot, { backgroundColor: C.bg, opacity: fadeAnim }]}>
      <View style={styles.logoArea}>
        <Animated.View style={[styles.ring, styles.ring1, { borderColor: C.goldMid, transform: [{ scale: pulse1 }] }]} />
        <Animated.View style={[styles.ring, styles.ring2, { borderColor: `${C.gold}55`, transform: [{ scale: pulse2 }] }]} />
        <Animated.View style={[styles.ring, styles.ring3, { borderColor: `${C.gold}88`, transform: [{ scale: pulse3 }] }]} />
        <Animated.View style={[styles.logoCircle, { backgroundColor: C.gold, transform: [{ scale: logoScale }] }]}>
          <View style={styles.brandRow}>
            <Text style={[styles.brandLetter, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>S</Text>
            <View style={[styles.brandDot, { backgroundColor: C.mode === "dark" ? "#1A1000" : "#F0E0B0" }]} />
            <Text style={[styles.brandLetterO, { color: C.mode === "dark" ? "#1A1000" : "#F0E0B0" }]}>O</Text>
            <View style={[styles.brandDot, { backgroundColor: C.mode === "dark" ? "#1A1000" : "#F0E0B0" }]} />
            <Text style={[styles.brandLetter, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>S</Text>
          </View>
        </Animated.View>
      </View>

      <Text style={[styles.appName, { color: C.textPrimary }]}>S·O·S</Text>
      <Text style={[styles.appTagline, { color: C.textMuted }]}>Your Personal Safety Guardian</Text>

      <View style={styles.dotsRow}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View key={i} style={[styles.loaderDot, { backgroundColor: C.gold, opacity: dot }]} />
        ))}
      </View>

      <Text style={[styles.version, { color: C.textDim }]}>v1.0.0</Text>
    </Animated.View>
  );
}

function AppNavigator() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShowLoading, setShouldShowLoading] = useState(true);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const [done] = await Promise.all([
          AsyncStorage.getItem("onboarding_complete"),
          new Promise((resolve) => setTimeout(resolve, 1800)),
        ]);
        if (!done) {
          router.replace("/onboarding");
        } else {
          router.replace("/(tabs)");
        }
      } catch {
        router.replace("/onboarding");
      } finally {
        setIsLoading(false);
      }
    }
    checkOnboarding();
  }, [router]);

  // Shared screen options — no animation = no flash/glitch on back
  const noAnimationOptions = {
    headerShown: false,
    animation: "none" as const,
  };

  return (
    <View style={styles.appRoot}>
      <Stack screenOptions={{ headerShown: false, animation: "none" }}>
        <Stack.Screen name="(tabs)" options={noAnimationOptions} />
        <Stack.Screen name="onboarding" options={noAnimationOptions} />
        <Stack.Screen name="alert" options={noAnimationOptions} />
        <Stack.Screen name="contacts" options={noAnimationOptions} />
        <Stack.Screen name="settings" options={noAnimationOptions} />
        <Stack.Screen name="fake-call" options={noAnimationOptions} />
        <Stack.Screen name="check-in" options={noAnimationOptions} />
        <Stack.Screen name="walk-home" options={noAnimationOptions} />
        <Stack.Screen name="emergency-numbers" options={noAnimationOptions} />
        <Stack.Screen name="tutorial" options={noAnimationOptions} />
        <Stack.Screen name="privacy" options={noAnimationOptions} />
        <Stack.Screen name="support" options={noAnimationOptions} />
        <Stack.Screen name="edit-profile" options={noAnimationOptions} />
        <Stack.Screen name="trusted-circle" options={noAnimationOptions} />
        <Stack.Screen name="recordings" options={noAnimationOptions} />
        <Stack.Screen name="location-map" options={noAnimationOptions} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", headerShown: false, animation: "none" }}
        />
      </Stack>
      {shouldShowLoading && (
        <LoadingScreen 
          isVisible={isLoading} 
          onFinish={() => setShouldShowLoading(false)}
        />
      )}
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const navigationRef = useRef(null);

  useEffect(() => {
    // Configure notification handler for foreground
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Register for push notifications
    registerForPushNotifications().catch(e => console.warn('Failed to register for notifications:', e));

    // Set up listeners
    const responseSubscription = setupNotificationResponseHandler(navigationRef);
    const receivedSubscription = setupForegroundNotificationListener((notification) => {
      console.log('Notification received:', notification);
    });

    return () => {
      responseSubscription?.remove();
      receivedSubscription?.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <NavigationThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <AppNavigator />
          <StatusBar style="auto" />
        </NavigationThemeProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  loadingRoot: {
    ...StyleSheet.absoluteFillObject,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  logoArea: { width: 200, height: 200, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  ring: { position: "absolute", borderWidth: 1.5, borderRadius: 999 },
  ring1: { width: 190, height: 190 },
  ring2: { width: 158, height: 158 },
  ring3: { width: 128, height: 128 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  brandLetter: { fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  brandLetterO: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  brandDot: { width: 4, height: 4, borderRadius: 2 },
  appName: { fontSize: 28, fontWeight: "900", letterSpacing: 4, marginTop: 4 },
  appTagline: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5 },
  dotsRow: { flexDirection: "row", gap: 8, marginTop: 24 },
  loaderDot: { width: 8, height: 8, borderRadius: 4 },
  version: { position: "absolute", bottom: 40, fontSize: 10, fontWeight: "600", letterSpacing: 1.5 },
});