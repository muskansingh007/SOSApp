import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const STORAGE_ITEMS = [
  { key: "contacts", label: "Emergency Contacts", desc: "Names & phone numbers of your trusted contacts", colorKey: "blue", bgKey: "blueDim", icon: "👥" },
  { key: "settings", label: "App Settings", desc: "SOS trigger, countdown, audio, language preferences", colorKey: "gold", bgKey: "goldMid", icon: "⚙️" },
  { key: "fake_caller_name", label: "Fake Call Name", desc: "Caller name used in fake call feature", colorKey: "purple", bgKey: "purpleDim", icon: "📞" },
  { key: "theme_mode", label: "Theme Preference", desc: "Dark or light mode setting", colorKey: "green", bgKey: "greenDim", icon: "🎨" },
];

export default function PrivacyScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useScrollToTop();
  const { visible, config, showAlert, hideAlert } = useThemedAlert();
  const [dataStatus, setDataStatus] = useState<Record<string, boolean>>({});

  useEffect(() => { checkDataStatus(); }, []);

  async function checkDataStatus() {
    const status: Record<string, boolean> = {};
    for (const item of STORAGE_ITEMS) {
      const val = await AsyncStorage.getItem(item.key);
      status[item.key] = val !== null && val !== "[]" && val !== "{}";
    }
    setDataStatus(status);
  }

  function clearItem(key: string) {
    const item = STORAGE_ITEMS.find((i) => i.key === key);
    showAlert({
      title: `Clear ${item?.label}?`,
      message: "This data will be permanently deleted from your device.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        { label: "Delete", destructive: true, onPress: async () => { await AsyncStorage.removeItem(key); await checkDataStatus(); } },
      ],
    });
  }

  function clearAllData() {
    showAlert({
      title: "Clear All Data?",
      message: "This will permanently delete all your contacts, settings, and preferences. This cannot be undone.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        {
          label: "Delete Everything", destructive: true,
          onPress: async () => {
            for (const item of STORAGE_ITEMS) await AsyncStorage.removeItem(item.key);
            await checkDataStatus();
            setTimeout(() => showAlert({
              title: "✓ All Data Cleared",
              message: "Your device is now clean.",
              buttons: [{ label: "OK", onPress: () => {}, primary: true }],
            }), 300);
          },
        },
      ],
    });
  }

  const hasAnyData = Object.values(dataStatus).some(Boolean);

  return (
    <View style={[s.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
      <View style={[s.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[s.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[s.navTitle, { color: C.textPrimary }]}>Privacy & Data</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}>

        <View style={[s.heroCard, { backgroundColor: C.goldMid, borderColor: C.gold + "55" }]}>
          <Text style={s.heroEmoji}>🔒</Text>
          <Text style={[s.heroTitle, { color: C.goldText }]}>Your Privacy Matters</Text>
          <Text style={[s.heroBody, { color: C.textSecondary }]}>S·O·S stores everything locally on your device. No servers. No tracking. No ads.</Text>
        </View>

        <Text style={[s.sectionHeader, { color: C.sectionHeader }]}>OUR PRIVACY PROMISE</Text>
        {[
          { icon: "📵", title: "No Data Collection", body: "We never collect, store, or transmit your personal data to any server." },
          { icon: "📍", title: "Location Only On Demand", body: "GPS is accessed only when SOS, Walk Home, or Safe Check-In is actively running." },
          { icon: "💬", title: "SMS Sent By You", body: "Alert messages are sent directly from your phone — not through any third-party service." },
          { icon: "🔑", title: "No Account Required", body: "S·O·S works fully offline. No login, no email, no account ever needed." },
          { icon: "👁️", title: "No Background Tracking", body: "The app never silently tracks your location or activity in the background." },
          { icon: "🗑️", title: "Full Data Control", body: "You can delete any or all stored data from this screen at any time." },
        ].map((p, i) => (
          <View key={i} style={[s.policyCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
            <Text style={s.policyIcon}>{p.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.policyTitle, { color: C.textPrimary }]}>{p.title}</Text>
              <Text style={[s.policyBody, { color: C.textMuted }]}>{p.body}</Text>
            </View>
          </View>
        ))}

        <Text style={[s.sectionHeader, { color: C.sectionHeader }]}>DATA STORED ON YOUR DEVICE</Text>
        {STORAGE_ITEMS.map((item) => {
          const color = C[item.colorKey as keyof typeof C] as string;
          const bg = C[item.bgKey as keyof typeof C] as string;
          const hasData = dataStatus[item.key] ?? false;
          return (
            <View key={item.key} style={[s.dataItem, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              <View style={[s.dataIcon, { backgroundColor: bg }]}><Text style={{ fontSize: 16 }}>{item.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[s.dataLabel, { color: C.textPrimary }]}>{item.label}</Text>
                <Text style={[s.dataDesc, { color: C.textMuted }]}>{item.desc}</Text>
                <View style={s.dataStatusRow}>
                  <View style={[s.dataStatusDot, { backgroundColor: hasData ? color : C.textDim }]} />
                  <Text style={[s.dataStatusTxt, { color: hasData ? color : C.textDim }]}>{hasData ? "Data stored" : "No data"}</Text>
                </View>
              </View>
              {hasData && (
                <TouchableOpacity onPress={() => clearItem(item.key)} style={[s.clearBtn, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
                  <Text style={[s.clearBtnTxt, { color: C.red }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <Text style={[s.sectionHeader, { color: C.sectionHeader }]}>DANGER ZONE</Text>
        <TouchableOpacity onPress={clearAllData} disabled={!hasAnyData}
          style={[s.clearAllBtn, { backgroundColor: hasAnyData ? C.redDim : C.bgTertiary, borderColor: hasAnyData ? C.red : C.border, opacity: hasAnyData ? 1 : 0.5 }]}>
          <Text style={[s.clearAllTxt, { color: hasAnyData ? C.red : C.textDim }]}>🗑️ Delete All My Data</Text>
          <Text style={[s.clearAllSub, { color: hasAnyData ? C.red + "99" : C.textDim }]}>Permanently removes all contacts, settings & preferences</Text>
        </TouchableOpacity>

        <Text style={[s.footer, { color: C.textDim }]}>S·O·S v1.0.0 · Made with ❤️ for your safety</Text>
      </ScrollView>

      <ThemedAlert visible={visible} title={config.title} message={config.message} buttons={config.buttons} C={C} onClose={hideAlert} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  scrollContent: { padding: 16, gap: 8 },
  heroCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  heroEmoji: { fontSize: 36 },
  heroTitle: { fontSize: 17, fontWeight: "900", textAlign: "center" },
  heroBody: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  sectionHeader: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 14, marginBottom: 2, marginLeft: 4 },
  policyCard: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  policyIcon: { fontSize: 20, marginTop: 1 },
  policyTitle: { fontSize: 13, fontWeight: "800", marginBottom: 3 },
  policyBody: { fontSize: 12, fontWeight: "500", lineHeight: 17 },
  dataItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  dataIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dataLabel: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  dataDesc: { fontSize: 10, fontWeight: "500", lineHeight: 14, marginBottom: 4 },
  dataStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  dataStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  dataStatusTxt: { fontSize: 10, fontWeight: "700" },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  clearBtnTxt: { fontSize: 11, fontWeight: "800" },
  clearAllBtn: { padding: 18, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 5 },
  clearAllTxt: { fontSize: 15, fontWeight: "900" },
  clearAllSub: { fontSize: 11, fontWeight: "500", textAlign: "center" },
  footer: { textAlign: "center", fontSize: 10, fontWeight: "500", marginTop: 12, letterSpacing: 0.5 },
});