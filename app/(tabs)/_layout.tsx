import { useTheme } from "@/context/ThemeContext";
import { Tabs } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function HomeIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", bottom: 0, width: 14, height: 10, borderWidth: 1.5, borderColor: color, borderRadius: 2 }} />
      <View style={{ position: "absolute", top: 0, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 10, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: color }} />
    </View>
  );
}

function ContactsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center", gap: 3 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color }} />
      <View style={{ width: 14, height: 5, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 1.5, borderColor: color, borderBottomWidth: 0 }} />
    </View>
  );
}

function SettingsIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: color }} />
      <View style={{ position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: color, borderStyle: "dashed" }} />
    </View>
  );
}

function CustomTabBar({ state, navigation }: { state: any; navigation: any }) {
  const { theme: C } = useTheme();
  const insets = useSafeAreaInsets();

  const tabs = [
    { key: "index", label: "Home", Icon: HomeIcon },
    { key: "contacts", label: "Contacts", Icon: ContactsIcon },
    { key: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: C.tabBg,
          borderTopColor: C.tabBorder,
          paddingBottom: Platform.OS === "ios" ? insets.bottom : 10,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const tab = tabs.find((t) => t.key === route.name) ?? tabs[0];
        const color = isFocused ? C.gold : C.textDim;

        function onPress() {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }

        function onLongPress() {
          navigation.emit({ type: "tabLongPress", target: route.key });
        }

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tab}
            onPress={onPress}
            onLongPress={onLongPress}
            activeOpacity={0.7}
          >
            {isFocused && (
              <View style={[styles.activeBar, { backgroundColor: C.gold }]} />
            )}
            <tab.Icon color={color} />
            <Text style={[styles.tabLabel, { color, fontWeight: isFocused ? "800" : "600" }]}>
              {tab.label}
            </Text>
            {isFocused && (
              <View style={[styles.activeDot, { backgroundColor: C.gold }]} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // Remove transition animation to eliminate the flash/glitch
        animation: "none",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="contacts" options={{ title: "Contacts" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingTop: 4,
  },
  tabLabel: { fontSize: 9, letterSpacing: 0.5 },
  activeBar: {
    position: "absolute",
    top: -10,
    width: 24,
    height: 2,
    borderRadius: 1,
  },
  activeDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
});