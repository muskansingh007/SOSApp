import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="alert"
          options={{
            title: "SOS ACTIVE",
            headerStyle: { backgroundColor: "#B71C1C" },
            headerTintColor: "#fff",
          }}
        />
        <Stack.Screen
          name="contacts"
          options={{
            title: "Emergency Contacts",
            headerStyle: { backgroundColor: "#D32F2F" },
            headerTintColor: "#fff",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            title: "Settings",
            headerStyle: { backgroundColor: "#D32F2F" },
            headerTintColor: "#fff",
          }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
