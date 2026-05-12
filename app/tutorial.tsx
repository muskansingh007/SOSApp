import { useTheme } from "@/context/ThemeContext";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");

interface TutorialStep {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  steps: string[];
  tip?: string;
  colorKey: "red" | "gold" | "green" | "blue" | "purple";
  bgKey: "redDim" | "goldMid" | "greenDim" | "blueDim" | "purpleDim";
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome", emoji: "🛡️", title: "Welcome to S·O·S", subtitle: "Your personal safety companion",
    steps: ["S·O·S keeps you safe with one-touch emergency alerts", "Your trusted contacts are notified instantly with your location", "Works even when you can't speak or type", "All data stays private on your device"],
    tip: "Set up emergency contacts first for the best experience", colorKey: "gold", bgKey: "goldMid",
  },
  {
    id: "sos", emoji: "🆘", title: "Triggering SOS", subtitle: "Send emergency alerts in seconds",
    steps: ["Hold the gold SOS button on the home screen for 3 seconds", "A countdown will appear — release to cancel", "On trigger: SMS + location sent to all contacts", "Optionally enable Shake-to-SOS in Settings"],
    tip: "You can change the hold duration to 1s, 3s, or 5s in Settings", colorKey: "red", bgKey: "redDim",
  },
  {
    id: "contacts", emoji: "👥", title: "Emergency Contacts", subtitle: "Who gets alerted when you need help",
    steps: ["Go to Contacts tab and tap Add", "Add up to 5 trusted people with their phone numbers", "The 1st contact is your primary — called first on SOS", "All contacts receive your location via SMS"],
    tip: "Add contacts who can reach you quickly and take action", colorKey: "blue", bgKey: "blueDim",
  },
  {
    id: "fake-call", emoji: "📞", title: "Fake Call", subtitle: "Escape uncomfortable situations",
    steps: ["Tap Fake Call from the home Quick Actions", "Set a custom caller name (e.g. Mom, Boss)", "Choose instant or delayed — up to 5 minutes", "Answer or decline as if it's a real call"],
    tip: "Use this to leave unsafe situations without drawing attention", colorKey: "gold", bgKey: "goldMid",
  },
  {
    id: "checkin", emoji: "✅", title: "Safe Check-In", subtitle: "Let contacts know you're okay",
    steps: ["Tap Safe Check-In from the home Quick Actions", "Set how often you want to check in (5 min to 1 hr)", "Tap I'M SAFE — message is sent automatically", "If you miss a check-in, contacts are auto-alerted"],
    tip: "Great for late-night travel or meeting strangers", colorKey: "green", bgKey: "greenDim",
  },
  {
    id: "walkhome", emoji: "🚶", title: "Walk Home Mode", subtitle: "Stay tracked on your route",
    steps: ["Tap Walk Home from the home Quick Actions", "Set your destination and expected walk duration", "Your route is shown on a live map", "Tap Arrived Safely — or SOS fires automatically"],
    tip: "Keep your screen on so the GPS stays active throughout", colorKey: "blue", bgKey: "blueDim",
  },
  {
    id: "privacy", emoji: "🔒", title: "Your Privacy", subtitle: "Your data, your control",
    steps: ["All contacts and settings stored only on your device", "No data is sent to any server without your action", "Location is shared only when SOS or Walk Home is active", "You can delete all data anytime from Privacy & Data"],
    tip: "S·O·S never tracks you silently in the background", colorKey: "purple", bgKey: "purpleDim",
  },
];

function StepCard({ step, C }: { step: TutorialStep; C: any }) {
  const color = C[step.colorKey];
  const bg = C[step.bgKey];
  return (
    <View style={[styles.slide, { width: SCREEN_W - 32 }]}>
      <View style={[styles.illustration, { backgroundColor: bg, borderColor: color + "55" }]}>
        <Text style={styles.illustrationEmoji}>{step.emoji}</Text>
        <View style={[styles.illustrationRing, { borderColor: color + "33" }]} />
        <View style={[styles.illustrationRing2, { borderColor: color + "18" }]} />
      </View>
      <Text style={[styles.slideTitle, { color: C.textPrimary }]}>{step.title}</Text>
      <Text style={[styles.slideSubtitle, { color: C.textMuted }]}>{step.subtitle}</Text>
      <View style={styles.stepsList}>
        {step.steps.map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: bg, borderColor: color }]}>
              <Text style={[styles.stepNumTxt, { color }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.stepTxt, { color: C.textSecondary }]}>{s}</Text>
          </View>
        ))}
      </View>
      {step.tip && (
        <View style={[styles.tipBox, { backgroundColor: bg, borderColor: color + "44" }]}>
          <Text style={[styles.tipLabel, { color }]}>💡 TIP</Text>
          <Text style={[styles.tipTxt, { color: C.textSecondary }]}>{step.tip}</Text>
        </View>
      )}
    </View>
  );
}

function DotIndicator({ total, current, C }: { total: number; current: number; C: any }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i === current ? C.gold : C.textDim, width: i === current ? 18 : 6 }]} />
      ))}
    </View>
  );
}

export default function TutorialScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const isLast = currentIndex === TUTORIAL_STEPS.length - 1;
  const isFirst = currentIndex === 0;

  function goNext() {
    if (isLast) { router.back(); return; }
    const next = currentIndex + 1;
    flatListRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  }

  function goPrev() {
    if (isFirst) return;
    const prev = currentIndex - 1;
    flatListRef.current?.scrollToIndex({ index: prev, animated: true });
    setCurrentIndex(prev);
  }

  function onScrollEnd(e: any) {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_W - 32 + 16));
    setCurrentIndex(idx);
  }

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>How to Use</Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.skipBtn, { color: C.textMuted }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stepCounter}>
        <Text style={[styles.stepCountTxt, { color: C.textDim }]}>{currentIndex + 1} of {TUTORIAL_STEPS.length}</Text>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={TUTORIAL_STEPS}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled={false}
        snapToInterval={SCREEN_W - 32 + 16}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.flatListContent}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        renderItem={({ item }) => <StepCard step={item} C={C} />}
        ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
        scrollEventThrottle={16}
      />

      <DotIndicator total={TUTORIAL_STEPS.length} current={currentIndex} C={C} />

      <View style={[styles.navBtns, { paddingBottom: insets.bottom + 16, borderTopColor: C.border }]}>
        <TouchableOpacity onPress={goPrev} disabled={isFirst}
          style={[styles.navBtn, { backgroundColor: isFirst ? C.bgTertiary : C.bgSecondary, borderColor: C.border, opacity: isFirst ? 0.4 : 1 }]}>
          <Text style={[styles.navBtnTxt, { color: C.textMuted }]}>← Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={goNext}
          style={[styles.navBtnPrimary, { backgroundColor: isLast ? C.green : C.gold }]}>
          <Text style={[styles.navBtnPrimaryTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>
            {isLast ? "✓ Done" : "Next →"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn: { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  skipBtn: { fontSize: 13, fontWeight: "600" },
  stepCounter: { alignItems: "center", paddingTop: 12, paddingBottom: 4 },
  stepCountTxt: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  flatListContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  slide: { gap: 16, paddingBottom: 8 },
  illustration: { height: 160, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  illustrationEmoji: { fontSize: 64, zIndex: 2 },
  illustrationRing: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  illustrationRing2: { position: "absolute", width: 200, height: 200, borderRadius: 100, borderWidth: 1 },
  slideTitle: { fontSize: 22, fontWeight: "900", letterSpacing: 0.3, textAlign: "center" },
  slideSubtitle: { fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: -8 },
  stepsList: { gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  stepNumTxt: { fontSize: 11, fontWeight: "900" },
  stepTxt: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 19 },
  tipBox: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 4 },
  tipLabel: { fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  tipTxt: { fontSize: 12, fontWeight: "600", lineHeight: 17 },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  dot: { height: 6, borderRadius: 3 },
  navBtns: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  navBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  navBtnTxt: { fontSize: 14, fontWeight: "700" },
  navBtnPrimary: { flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  navBtnPrimaryTxt: { fontSize: 14, fontWeight: "900", letterSpacing: 0.3 },
});