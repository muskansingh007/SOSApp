import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

export const DarkTheme = {
  mode: "dark" as const,
  bg: "#0A0A0A", bgSecondary: "#111111", bgTertiary: "#161616",
  border: "#1A1A1A", borderGold: "#1E1E00", borderGoldMid: "#2A2000",
  gold: "#B8962E", goldDim: "#2A2000", goldMid: "#1E1800", goldText: "#EAC14A",
  red: "#DC2626", redDim: "#1E0808", white: "#FFFFFF",
  textPrimary: "#EEEEEE", textSecondary: "#888888", textMuted: "#555555", textDim: "#333333",
  pillBg: "#1E1800", pillBorder: "#2A2000",
  cardBg: "#111111", cardBorder: "#1E1E00",
  inputBg: "#0A0A0A", inputBorder: "#2A2A2A",
  tabBg: "#0D0D0D", tabBorder: "#1A1A1A",
  drawerBg: "#0E0E0E", sectionHeader: "#B8962E",
  green: "#22C55E", greenDim: "#001A08",
  blue: "#378ADD", blueDim: "#001020",
  purple: "#7F77DD", purpleDim: "#100818",
  toggleTrackOn: "#B8962E", toggleTrackOff: "#222222",
  statusBarStyle: "light-content" as const,
};

export const LightTheme = {
  mode: "light" as const,
  bg: "#F7F5EE", bgSecondary: "#FFFFFF", bgTertiary: "#EFEFEA",
  border: "#E5E2D8", borderGold: "#E8D9A0", borderGoldMid: "#D4BA6A",
  gold: "#8A6A10", goldDim: "#FDF3D8", goldMid: "#FEF9EC", goldText: "#6B4F0C",
  red: "#C0392B", redDim: "#FDECEA", white: "#FFFFFF",
  textPrimary: "#1A1A1A", textSecondary: "#555555", textMuted: "#888888", textDim: "#BBBBBB",
  pillBg: "#FEF9EC", pillBorder: "#E8D9A0",
  cardBg: "#FFFFFF", cardBorder: "#E5E2D8",
  inputBg: "#F7F5EE", inputBorder: "#DDDBD0",
  tabBg: "#FFFFFF", tabBorder: "#E5E2D8",
  drawerBg: "#FFFFFF", sectionHeader: "#8A6A10",
  green: "#16A34A", greenDim: "#F0FDF4",
  blue: "#1D6FB8", blueDim: "#EFF6FF",
  purple: "#5B52C0", purpleDim: "#F5F3FF",
  toggleTrackOn: "#8A6A10", toggleTrackOff: "#D1D5DB",
  statusBarStyle: "dark-content" as const,
};

export type Theme = typeof DarkTheme | typeof LightTheme;

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: LightTheme,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default = light. Only go dark if user explicitly chose dark previously.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("theme_mode").then((v) => {
      // null  → first launch → stay light
      // "dark" → user chose dark
      // "light" → user chose light
      if (v === "dark") setIsDark(true);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem("theme_mode", next ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? DarkTheme : LightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);