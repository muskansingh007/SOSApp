import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface HelplineEntry {
  name: string;
  number: string;
  desc: string;
  available: string;
  colorKey: "red" | "blue" | "green" | "gold" | "purple";
}

interface HelplineCategory {
  category: string;
  icon: string;
  entries: HelplineEntry[];
}

const HELPLINES: HelplineCategory[] = [
  {
    category: "Emergency Services", icon: "🚨",
    entries: [
      { name: "Police", number: "100", desc: "National police emergency", available: "24/7", colorKey: "blue" },
      { name: "Ambulance", number: "108", desc: "Medical emergency ambulance", available: "24/7", colorKey: "red" },
      { name: "Fire Brigade", number: "101", desc: "Fire & rescue services", available: "24/7", colorKey: "red" },
      { name: "Disaster Management", number: "108", desc: "National disaster helpline", available: "24/7", colorKey: "gold" },
    ],
  },
  {
    category: "Women Safety", icon: "👩‍⚕️",
    entries: [
      { name: "Women Helpline", number: "1091", desc: "National women distress helpline", available: "24/7", colorKey: "purple" },
      { name: "Women Helpline (Domestic Abuse)", number: "181", desc: "Domestic violence support", available: "24/7", colorKey: "purple" },
      { name: "NCW Helpline", number: "7827170170", desc: "National Commission for Women", available: "Mon–Sat", colorKey: "purple" },
      { name: "Nirbhaya Helpline", number: "112", desc: "Women emergency response", available: "24/7", colorKey: "red" },
    ],
  },
  {
    category: "Child Safety", icon: "🧒",
    entries: [
      { name: "Childline India", number: "1098", desc: "Child abuse & protection", available: "24/7", colorKey: "green" },
      { name: "Missing Children", number: "1094", desc: "Report missing child", available: "24/7", colorKey: "gold" },
    ],
  },
  {
    category: "Mental Health", icon: "🧠",
    entries: [
      { name: "iCall", number: "9152987821", desc: "Mental health counselling (TISS)", available: "Mon–Sat 8am–10pm", colorKey: "blue" },
      { name: "Vandrevala Foundation", number: "1860-2662-345", desc: "Mental health & suicide prevention", available: "24/7", colorKey: "blue" },
      { name: "Snehi", number: "044-24640050", desc: "Emotional support helpline", available: "24/7", colorKey: "purple" },
    ],
  },
  {
    category: "Senior Citizens", icon: "👴",
    entries: [
      { name: "Elder Line", number: "14567", desc: "National helpline for elderly", available: "8am–8pm", colorKey: "gold" },
    ],
  },
  {
    category: "Unified Emergency", icon: "📞",
    entries: [
      { name: "National Emergency Number", number: "112", desc: "Single emergency number — police, fire, medical", available: "24/7", colorKey: "red" },
    ],
  },
];

// ─── Call button — uses ThemedAlert passed via prop ───────────────────────────
function HelplineCard({
  entry, C, onCallPress,
}: {
  entry: HelplineEntry; C: any; onCallPress: (number: string) => void;
}) {
  const color = C[entry.colorKey];
  return (
    <View style={[styles.helplineCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={styles.helplineLeft}>
        <View style={[styles.colorBar, { backgroundColor: color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.helplineName, { color: C.textPrimary }]}>{entry.name}</Text>
          <Text style={[styles.helplineDesc, { color: C.textMuted }]}>{entry.desc}</Text>
          <View style={styles.availRow}>
            <View style={[styles.availDot, { backgroundColor: C.green }]} />
            <Text style={[styles.availTxt, { color: C.textDim }]}>{entry.available}</Text>
          </View>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onCallPress(entry.number)}
        style={[styles.callBtn, { backgroundColor: C.red }]}
        activeOpacity={0.8}
      >
        <Text style={styles.callBtnTxt}>{entry.number}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CategorySection({
  category, C, onCallPress,
}: {
  category: HelplineCategory; C: any; onCallPress: (number: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View style={styles.categoryBlock}>
      <TouchableOpacity style={styles.categoryHeader} onPress={() => setExpanded((e) => !e)} activeOpacity={0.7}>
        <View style={styles.categoryLeft}>
          <Text style={styles.categoryIcon}>{category.icon}</Text>
          <Text style={[styles.categoryTitle, { color: C.sectionHeader }]}>{category.category.toUpperCase()}</Text>
          <View style={[styles.countBadge, { backgroundColor: C.goldMid, borderColor: C.gold }]}>
            <Text style={[styles.countTxt, { color: C.goldText }]}>{category.entries.length}</Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: C.textDim }]}>{expanded ? "▾" : "▸"}</Text>
      </TouchableOpacity>
      {expanded && category.entries.map((entry, i) => (
        <HelplineCard key={i} entry={entry} C={C} onCallPress={onCallPress} />
      ))}
    </View>
  );
}

export default function EmergencyNumbersScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useScrollToTop();
  const { visible, config, showAlert, hideAlert } = useThemedAlert();

  function handleCallPress(number: string) {
    showAlert({
      title: `Call ${number}?`,
      message: "This will open your phone dialer.",
      buttons: [
        { label: "Cancel", onPress: () => {} },
        {
          label: "Call Now", primary: true,
          onPress: () => {
            const clean = number.replace(/[^0-9+]/g, "");
            Linking.openURL(`tel:${clean}`);
          },
        },
      ],
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Emergency Numbers</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.alertBanner, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
        <Text style={styles.alertEmoji}>🚨</Text>
        <Text style={[styles.alertTxt, { color: C.red }]}>
          In immediate danger? Call <Text style={{ fontWeight: "900" }}>112</Text> now
        </Text>
        <TouchableOpacity
          onPress={() => handleCallPress("112")}
          style={[styles.call112Btn, { backgroundColor: C.red }]}
        >
          <Text style={styles.call112Txt}>CALL</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>
        {HELPLINES.map((cat, i) => (
          <CategorySection key={i} category={cat} C={C} onCallPress={handleCallPress} />
        ))}
        <Text style={[styles.disclaimer, { color: C.textDim }]}>
          Numbers verified for India. Always call 112 in immediate danger.
        </Text>
      </ScrollView>

      <ThemedAlert visible={visible} title={config.title} message={config.message}
        buttons={config.buttons} C={C} onClose={hideAlert} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  alertBanner: { flexDirection: "row", alignItems: "center", gap: 10, margin: 16, marginBottom: 4, padding: 14, borderRadius: 14, borderWidth: 1 },
  alertEmoji: { fontSize: 16 },
  alertTxt: { flex: 1, fontSize: 13, fontWeight: "600" },
  call112Btn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10 },
  call112Txt: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  scrollContent: { padding: 16, gap: 8 },
  categoryBlock: { marginBottom: 8 },
  categoryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  categoryIcon: { fontSize: 16 },
  categoryTitle: { fontSize: 9, fontWeight: "800", letterSpacing: 2 },
  countBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 1 },
  countTxt: { fontSize: 9, fontWeight: "800" },
  chevron: { fontSize: 13, fontWeight: "700" },
  helplineCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 14, marginBottom: 6, padding: 14, gap: 12 },
  helplineLeft: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 10 },
  colorBar: { width: 3, height: "100%", borderRadius: 2, minHeight: 44 },
  helplineName: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  helplineDesc: { fontSize: 11, fontWeight: "500", marginBottom: 4, lineHeight: 15 },
  availRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  availDot: { width: 5, height: 5, borderRadius: 2.5 },
  availTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3 },
  callBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  callBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  disclaimer: { fontSize: 10, fontWeight: "500", textAlign: "center", marginTop: 12, lineHeight: 15 },
});