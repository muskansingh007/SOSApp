import { useTheme } from "@/context/ThemeContext";
import { getFeedbackSettings } from "@/utils/appSettings";
import { sendLocalNotification } from "@/utils/notifications";
import { playEmergencySound, playSuccessSound } from "@/utils/soundEffects";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SMS from "expo-sms";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Contact {
  name: string;
  phone: string;
}

type CheckInState = "setup" | "active" | "safe" | "missed";

const INTERVALS = [5, 10, 15, 30, 60, 120];

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function CheckInScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [checkInState, setCheckInState] = useState<CheckInState>("setup");
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [customMessage, setCustomMessage] = useState("I'm safe ✓");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [location, setLocation] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const feedbackRef = useRef({ notificationsEnabled: true, soundEnabled: true });

  useEffect(() => {
    loadContacts();
    loadFeedbackSettings();
    fetchLocation();
    return () => stopTimer();
  }, []);

  async function loadFeedbackSettings() {
    feedbackRef.current = await getFeedbackSettings();
  }

  async function playFeedback(type: Haptics.NotificationFeedbackType) {
    if (feedbackRef.current.soundEnabled) {
      await Haptics.notificationAsync(type);
    }
  }

  // ── Pulse for missed state ──
  useEffect(() => {
    if (checkInState === "missed") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [checkInState, pulseAnim]);

  async function loadContacts() {
    const v = await AsyncStorage.getItem("contacts");
    if (v) setContacts(JSON.parse(v));
  }

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(
        `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`
      );
    } catch {}
  }

  function startCheckIn() {
    if (contacts.length === 0) return;
    setCheckInState("active");
    const totalSecs = intervalMinutes * 60;
    setTimeLeft(totalSecs);
    startTimer(totalSecs);
    startProgress(totalSecs);
    void playFeedback(Haptics.NotificationFeedbackType.Success);
    void sendLocalNotification("Check-In Started", `Timer set for ${intervalMinutes} minutes.`);
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          triggerMissed();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function startProgress(totalSeconds: number) {
    progressAnim.setValue(1);
    progressRef.current = Animated.timing(progressAnim, {
      toValue: 0,
      duration: totalSeconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressRef.current.start();
  }

  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    progressRef.current?.stop();
  }

  async function handleSafeCheckIn() {
    stopTimer();
    await playFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();

    const msg = buildSafeMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable && contacts.length > 0) {
      await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
    }

    const newCount = checkInCount + 1;
    setCheckInCount(newCount);
    setCheckInState("safe");
    void sendLocalNotification("Safe Check-In Sent", "Your safe check-in message was prepared for your contacts.");

    // Resume after 2 seconds
    setTimeout(() => {
      setCheckInState("active");
      const totalSecs = intervalMinutes * 60;
      setTimeLeft(totalSecs);
      startTimer(totalSecs);
      startProgress(totalSecs);
    }, 2000);
  }

  async function triggerMissed() {
    setCheckInState("missed");
    await playFeedback(Haptics.NotificationFeedbackType.Error);
    void playEmergencySound();

    const msg = buildMissedMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable && contacts.length > 0) {
      await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
    }
    void sendLocalNotification("Check-In Missed", "Your emergency contacts were alerted.");
  }

  async function handleResume() {
    const newCount = checkInCount + 1;
    setCheckInCount(newCount);
    setCheckInState("active");
    const totalSecs = intervalMinutes * 60;
    setTimeLeft(totalSecs);
    startTimer(totalSecs);
    startProgress(totalSecs);
    await playFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();
    void sendLocalNotification("Check-In Resumed", `Next check-in is due in ${intervalMinutes} minutes.`);
  }

  function buildSafeMessage() {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${customMessage} — checked in at ${time}.${
      location ? ` Location: ${location}` : ""
    }`;
  }

  function buildMissedMessage() {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `🚨 SOS ALERT: Check-in missed at ${time}.${
      location ? ` Last known location: ${location}` : ""
    }`;
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const progressColor = progressAnim.interpolate({
    inputRange: [0, 0.25, 1],
    outputRange: [C.red, "#EF9F27", C.green],
  });

  return (
    <View
      style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}
    >
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity
          onPress={() => {
            stopTimer();
            router.back();
          }}
          hitSlop={12}
        >
          <Text style={[styles.backBtn, { color: C.gold }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>
          Safe Check-In
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* ════════════════════════
            SETUP
        ════════════════════════ */}
        {checkInState === "setup" && (
          <>
            {/* Hero */}
            <View
              style={[
                styles.heroCard,
                { backgroundColor: C.greenDim, borderColor: C.green + "44" },
              ]}
            >
              <Text style={styles.heroEmoji}>✅</Text>
              <Text style={[styles.heroTitle, { color: C.green }]}>
                Safe Check-In
              </Text>
              <Text style={[styles.heroBody, { color: C.textSecondary }]}>
                Set a timer and check in regularly. If you miss a check-in,
                your contacts are automatically alerted.
              </Text>
            </View>

            {/* Interval */}
            <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>
              CHECK-IN INTERVAL
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: C.cardBg, borderColor: C.cardBorder },
              ]}
            >
              <View style={styles.chipGrid}>
                {INTERVALS.map((min) => (
                  <TouchableOpacity
                    key={min}
                    onPress={() => setIntervalMinutes(min)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor:
                          intervalMinutes === min ? C.greenDim : C.bgTertiary,
                        borderColor:
                          intervalMinutes === min ? C.green : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipTxt,
                        {
                          color:
                            intervalMinutes === min ? C.green : C.textMuted,
                        },
                      ]}
                    >
                      {min < 60 ? `${min}m` : `${min / 60}h`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Safe message */}
            <Text
              style={[
                styles.sectionLabel,
                { color: C.sectionHeader, marginTop: 20 },
              ]}
            >
              SAFE MESSAGE
            </Text>
            <TextInput
              value={customMessage}
              onChangeText={setCustomMessage}
              placeholder="Message sent when you check in safely"
              placeholderTextColor={C.textDim}
              maxLength={80}
              style={[
                styles.input,
                {
                  backgroundColor: C.inputBg,
                  borderColor: C.inputBorder,
                  color: C.textPrimary,
                },
              ]}
            />

            {/* How it works */}
            <Text
              style={[
                styles.sectionLabel,
                { color: C.sectionHeader, marginTop: 20 },
              ]}
            >
              HOW IT WORKS
            </Text>
            <View style={styles.howList}>
              {[
                { icon: "⏱", text: "Timer starts when you tap Start" },
                { icon: "✅", text: "Tap I'M SAFE before timer runs out" },
                { icon: "📨", text: "Safe message sent to all contacts" },
                { icon: "🚨", text: "Miss a check-in → contacts alerted" },
                { icon: "🔁", text: "Timer resets automatically each round" },
              ].map((h, i) => (
                <View
                  key={i}
                  style={[
                    styles.howRow,
                    { backgroundColor: C.cardBg, borderColor: C.cardBorder },
                  ]}
                >
                  <Text style={styles.howIcon}>{h.icon}</Text>
                  <Text style={[styles.howTxt, { color: C.textSecondary }]}>
                    {h.text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Contacts */}
            <Text
              style={[
                styles.sectionLabel,
                { color: C.sectionHeader, marginTop: 20 },
              ]}
            >
              ALERTING
            </Text>
            {contacts.length === 0 ? (
              <View
                style={[
                  styles.noContactsCard,
                  { backgroundColor: C.redDim, borderColor: C.red + "44" },
                ]}
              >
                <Text style={[styles.noContactsTxt, { color: C.red }]}>
                  ⚠ No emergency contacts set. Add contacts first.
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/contacts")}
                  style={[styles.addContactBtn, { backgroundColor: C.red }]}
                >
                  <Text style={styles.addContactBtnTxt}>Add Contacts →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.contactsList}>
                {contacts.slice(0, 3).map((c, i) => (
                  <View
                    key={i}
                    style={[
                      styles.contactRow,
                      {
                        backgroundColor: C.cardBg,
                        borderColor: C.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.contactDot,
                        { backgroundColor: C.greenDim },
                      ]}
                    >
                      <Text
                        style={[styles.contactInitial, { color: C.green }]}
                      >
                        {c.name[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text
                      style={[styles.contactName, { color: C.textPrimary }]}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={[styles.contactPhone, { color: C.textMuted }]}
                    >
                      {c.phone}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Start */}
            <TouchableOpacity
              onPress={startCheckIn}
              disabled={contacts.length === 0}
              style={[
                styles.startBtn,
                {
                  backgroundColor:
                    contacts.length === 0 ? C.bgTertiary : C.green,
                  marginTop: 28,
                },
              ]}
            >
              <Text
                style={[
                  styles.startBtnTxt,
                  {
                    color: contacts.length === 0 ? C.textMuted : "#fff",
                  },
                ]}
              >
                ✅ Start Check-In
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ════════════════════════
            ACTIVE
        ════════════════════════ */}
        {(checkInState === "active" || checkInState === "safe") && (
          <View style={styles.activeContainer}>
            {/* Safe flash */}
            {checkInState === "safe" && (
              <View
                style={[
                  styles.safeBadge,
                  { backgroundColor: C.greenDim, borderColor: C.green },
                ]}
              >
                <Text style={[styles.safeBadgeTxt, { color: C.green }]}>
                  ✓ SAFE MESSAGE SENT
                </Text>
              </View>
            )}

            {/* Status badge */}
            {checkInState === "active" && (
              <View
                style={[
                  styles.activeBadge,
                  { backgroundColor: C.greenDim, borderColor: C.green },
                ]}
              >
                <View
                  style={[styles.activeDot, { backgroundColor: C.green }]}
                />
                <Text style={[styles.activeBadgeTxt, { color: C.green }]}>
                  CHECK-IN ACTIVE
                </Text>
              </View>
            )}

            {/* Timer ring */}
            <View style={[styles.timerRing, { borderColor: C.green }]}>
              <Text style={[styles.timerNum, { color: C.green }]}>
                {formatTime(timeLeft)}
              </Text>
              <Text style={[styles.timerSub, { color: C.textMuted }]}>
                until alert
              </Text>
            </View>

            {/* Progress bar */}
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: C.bgTertiary },
              ]}
            >
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: progressWidth, backgroundColor: progressColor },
                ]}
              />
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: C.cardBg, borderColor: C.cardBorder },
                ]}
              >
                <Text style={[styles.statNum, { color: C.gold }]}>
                  {checkInCount}
                </Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>
                  Check-ins
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: C.cardBg, borderColor: C.cardBorder },
                ]}
              >
                <Text style={[styles.statNum, { color: C.blue }]}>
                  {intervalMinutes < 60
                    ? `${intervalMinutes}m`
                    : `${intervalMinutes / 60}h`}
                </Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>
                  Interval
                </Text>
              </View>
              <View
                style={[
                  styles.statCard,
                  { backgroundColor: C.cardBg, borderColor: C.cardBorder },
                ]}
              >
                <Text style={[styles.statNum, { color: C.green }]}>
                  {contacts.length}
                </Text>
                <Text style={[styles.statLabel, { color: C.textMuted }]}>
                  Contacts
                </Text>
              </View>
            </View>

            {/* I'm safe button */}
            <TouchableOpacity
              onPress={handleSafeCheckIn}
              style={[styles.safeBtn, { backgroundColor: C.green }]}
            >
              <Text style={styles.safeBtnTxt}>✅ I&apos;M SAFE</Text>
            </TouchableOpacity>

            {/* Stop */}
            <TouchableOpacity
              onPress={() => {
                stopTimer();
                router.back();
              }}
              style={[
                styles.stopBtn,
                { borderColor: C.border, backgroundColor: C.bgTertiary },
              ]}
            >
              <Text style={[styles.stopBtnTxt, { color: C.textMuted }]}>
                Stop Check-In
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════════════════════════
            MISSED
        ════════════════════════ */}
        {checkInState === "missed" && (
          <View style={styles.activeContainer}>
            <Animated.View
              style={[
                styles.missedCircle,
                {
                  backgroundColor: C.redDim,
                  borderColor: C.red,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <Text style={styles.missedEmoji}>🚨</Text>
            </Animated.View>

            <Text style={[styles.missedTitle, { color: C.red }]}>
              CHECK-IN MISSED
            </Text>
            <Text style={[styles.missedInfo, { color: C.textSecondary }]}>
              Your emergency contacts have been notified with your last known
              location. Are you safe?
            </Text>

            <View
              style={[
                styles.missedStats,
                { backgroundColor: C.redDim, borderColor: C.red + "44" },
              ]}
            >
              <Text style={[styles.missedStatTxt, { color: C.red }]}>
                {checkInCount} check-in{checkInCount !== 1 ? "s" : ""} completed before miss
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleResume}
              style={[
                styles.startBtn,
                { backgroundColor: C.green, width: "100%" },
              ]}
            >
              <Text style={[styles.startBtnTxt, { color: "#fff" }]}>
                ✓ I&apos;m Safe — Resume Check-In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                stopTimer();
                router.back();
              }}
              style={[
                styles.stopBtn,
                { borderColor: C.border, backgroundColor: C.bgTertiary },
              ]}
            >
              <Text style={[styles.stopBtnTxt, { color: C.textMuted }]}>
                Stop
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  topNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { fontSize: 14, fontWeight: "700" },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },

  scrollContent: { padding: 16 },

  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  heroEmoji: { fontSize: 40, marginBottom: 4 },
  heroTitle: { fontSize: 18, fontWeight: "900" },
  heroBody: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
  },

  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },

  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 13, fontWeight: "700" },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 13,
    fontWeight: "600",
  },

  howList: { gap: 8 },
  howRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  howIcon: { fontSize: 18 },
  howTxt: { fontSize: 13, fontWeight: "600", flex: 1 },

  noContactsCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    alignItems: "flex-start",
  },
  noContactsTxt: { fontSize: 13, fontWeight: "700" },
  addContactBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  addContactBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },

  contactsList: { gap: 8 },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  contactDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  contactInitial: { fontSize: 13, fontWeight: "900" },
  contactName: { flex: 1, fontSize: 13, fontWeight: "700" },
  contactPhone: { fontSize: 11, fontWeight: "500" },

  startBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  startBtnTxt: { fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },

  // Active
  activeContainer: { alignItems: "center", gap: 16, paddingTop: 8 },

  safeBadge: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
  },
  safeBadgeTxt: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },

  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  timerRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  timerNum: { fontSize: 42, fontWeight: "900", letterSpacing: 2 },
  timerSub: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },

  progressTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3 },

  statsRow: { flexDirection: "row", gap: 10, width: "100%" },
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  statNum: { fontSize: 20, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  safeBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 4,
  },
  safeBtnTxt: {
    fontSize: 16,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },

  stopBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  stopBtnTxt: { fontSize: 13, fontWeight: "700" },

  // Missed
  missedCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  missedEmoji: { fontSize: 48 },
  missedTitle: { fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  missedInfo: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  missedStats: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  missedStatTxt: { fontSize: 12, fontWeight: "700" },
});
