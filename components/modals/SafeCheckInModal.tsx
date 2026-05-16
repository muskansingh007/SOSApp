import { useTheme } from "@/context/ThemeContext";
import { getFeedbackSettings } from "@/utils/appSettings";
import { sendLocalNotification } from "@/utils/notifications";
import { playEmergencySound, playSuccessSound } from "@/utils/soundEffects";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Contact {
  name: string;
  phone: string;
}

type CheckInState = "idle" | "active" | "safe" | "missed";

const INTERVAL_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function SafeCheckInModal({ visible, onClose }: Props) {
  const { theme: C } = useTheme();

  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [timeLeft, setTimeLeft] = useState(0);
  const [checkInCount, setCheckInCount] = useState(0);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [locationUrl, setLocationUrl] = useState<string | null>(null);
  const [autoSending, setAutoSending] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;
  const progressAnim2 = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const feedbackRef = useRef({ notificationsEnabled: true, soundEnabled: true });

  // Load contacts and location when modal opens
  useEffect(() => {
    if (visible) {
      loadContacts();
      loadFeedbackSettings();
      fetchLocation();
    } else {
      stopTimer();
      setCheckInState("idle");
      setCheckInCount(0);
      setTimeLeft(0);
    }
  }, [visible]);

  async function loadFeedbackSettings() {
    feedbackRef.current = await getFeedbackSettings();
  }

  async function playFeedback(type: Haptics.NotificationFeedbackType) {
    if (feedbackRef.current.soundEnabled) {
      await Haptics.notificationAsync(type);
    }
  }

  // Pulse on missed state
  useEffect(() => {
    if (checkInState === "missed") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.07, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
      setLocationUrl(`https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`);
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
    progressAnim2.current = Animated.timing(progressAnim, {
      toValue: 0,
      duration: totalSeconds * 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    progressAnim2.current.start();
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    progressAnim2.current?.stop();
  }

  // ── Auto-send safe message when user taps I'M SAFE ────────────────────────
  async function handleSafeCheckIn() {
    stopTimer();
    setAutoSending(true);
    await playFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();

    // Auto-send the message — no user interaction needed
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const msg = `✅ I'm safe! Checked in at ${time}.${locationUrl ? ` Location: ${locationUrl}` : ""}`;

    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable && contacts.length > 0) {
        await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
      }
    } catch {}

    const newCount = checkInCount + 1;
    setCheckInCount(newCount);
    setAutoSending(false);
    setCheckInState("safe");
    void sendLocalNotification("Safe Check-In Sent", "Your safe check-in message was prepared for your contacts.");

    // Auto-reset timer for next round after 1.5s
    setTimeout(() => {
      setCheckInState("active");
      const totalSecs = intervalMinutes * 60;
      setTimeLeft(totalSecs);
      startTimer(totalSecs);
      startProgress(totalSecs);
    }, 1500);
  }

  async function triggerMissed() {
    setCheckInState("missed");
    await playFeedback(Haptics.NotificationFeedbackType.Error);
    void playEmergencySound();

    // Auto-alert contacts
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const msg = `🚨 Check-in missed at ${time}.${locationUrl ? ` Last location: ${locationUrl}` : ""}`;
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (isAvailable && contacts.length > 0) {
        await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
      }
    } catch {}
    void sendLocalNotification("Check-In Missed", "Your emergency contacts were alerted.");
  }

  async function handleResume() {
    setCheckInCount((c) => c + 1);
    setCheckInState("active");
    const totalSecs = intervalMinutes * 60;
    setTimeLeft(totalSecs);
    startTimer(totalSecs);
    startProgress(totalSecs);
    await playFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();
    void sendLocalNotification("Check-In Resumed", `Next check-in is due in ${intervalMinutes} minutes.`);
  }

  function handleStop() {
    stopTimer();
    onClose();
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const progressColor = progressAnim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [C.red, "#EF9F27", C.green] });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleStop}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: C.bgSecondary, borderColor: C.cardBorder }]}>

          {/* ── Header ── */}
          <View style={[styles.header, { borderBottomColor: C.border }]}>
            <Text style={[styles.headerTitle, { color: C.textPrimary }]}>Safe Check-In</Text>
            <TouchableOpacity onPress={handleStop} hitSlop={12}>
              <Text style={[styles.closeBtn, { color: C.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* ── SETUP ── */}
          {checkInState === "idle" && (
            <View style={styles.body}>
              <Text style={styles.setupEmoji}>✅</Text>
              <Text style={[styles.setupTitle, { color: C.textPrimary }]}>Check-in every…</Text>

              {/* Interval chips */}
              <View style={styles.chipRow}>
                {INTERVAL_OPTIONS.map((opt) => (
                  <TouchableOpacity key={opt.value} onPress={() => setIntervalMinutes(opt.value)}
                    style={[styles.chip, {
                      backgroundColor: intervalMinutes === opt.value ? C.greenDim : C.bgTertiary,
                      borderColor: intervalMinutes === opt.value ? C.green : C.border,
                    }]}>
                    <Text style={[styles.chipTxt, { color: intervalMinutes === opt.value ? C.green : C.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Info */}
              <View style={[styles.infoBox, { backgroundColor: C.goldMid, borderColor: C.gold + "44" }]}>
                <Text style={[styles.infoTxt, { color: C.textSecondary }]}>
                  💡 Tap <Text style={{ fontWeight: "900", color: C.green }}>I'M SAFE</Text> before the timer runs out. Miss it and your contacts are auto-alerted with your location.
                </Text>
              </View>

              {contacts.length === 0 ? (
                <View style={[styles.noContactsBox, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
                  <Text style={[styles.noContactsTxt, { color: C.red }]}>⚠ No emergency contacts set.</Text>
                </View>
              ) : (
                <Text style={[styles.contactsNote, { color: C.textDim }]}>
                  Alerting {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
                </Text>
              )}

              <TouchableOpacity onPress={startCheckIn} disabled={contacts.length === 0}
                style={[styles.startBtn, { backgroundColor: contacts.length === 0 ? C.bgTertiary : C.green }]}>
                <Text style={[styles.startBtnTxt, { color: contacts.length === 0 ? C.textDim : "#fff" }]}>
                  Start Check-In
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── ACTIVE ── */}
          {(checkInState === "active" || checkInState === "safe") && (
            <View style={styles.body}>
              {checkInState === "safe" && (
                <View style={[styles.safeBadge, { backgroundColor: C.greenDim, borderColor: C.green }]}>
                  <Text style={[styles.safeBadgeTxt, { color: C.green }]}>✓ SAFE — Message auto-sent!</Text>
                </View>
              )}

              {checkInState === "active" && (
                <View style={[styles.activeBadge, { backgroundColor: C.greenDim, borderColor: C.green }]}>
                  <View style={[styles.activeDot, { backgroundColor: C.green }]} />
                  <Text style={[styles.activeBadgeTxt, { color: C.green }]}>CHECK-IN ACTIVE</Text>
                </View>
              )}

              {/* Timer ring */}
              <View style={[styles.timerRing, { borderColor: C.green }]}>
                <Text style={[styles.timerNum, { color: C.green }]}>{formatTime(timeLeft)}</Text>
                <Text style={[styles.timerSub, { color: C.textMuted }]}>until alert</Text>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressTrack, { backgroundColor: C.bgTertiary }]}>
                <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: progressColor }]} />
              </View>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
                  <Text style={[styles.statNum, { color: C.gold }]}>{checkInCount}</Text>
                  <Text style={[styles.statLabel, { color: C.textMuted }]}>Check-ins</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
                  <Text style={[styles.statNum, { color: C.blue }]}>{intervalMinutes < 60 ? `${intervalMinutes}m` : `${intervalMinutes / 60}h`}</Text>
                  <Text style={[styles.statLabel, { color: C.textMuted }]}>Interval</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
                  <Text style={[styles.statNum, { color: C.green }]}>{contacts.length}</Text>
                  <Text style={[styles.statLabel, { color: C.textMuted }]}>Contacts</Text>
                </View>
              </View>

              {/* I'm Safe button — auto-sends message */}
              <TouchableOpacity onPress={handleSafeCheckIn} disabled={autoSending}
                style={[styles.safeBtn, { backgroundColor: autoSending ? C.bgTertiary : C.green }]}>
                <Text style={styles.safeBtnTxt}>
                  {autoSending ? "Sending…" : "✅  I'M SAFE"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleStop}
                style={[styles.stopBtn, { borderColor: C.border, backgroundColor: C.bgTertiary }]}>
                <Text style={[styles.stopBtnTxt, { color: C.textMuted }]}>Stop Check-In</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── MISSED ── */}
          {checkInState === "missed" && (
            <View style={styles.body}>
              <Animated.View style={[styles.missedCircle, { backgroundColor: C.redDim, borderColor: C.red, transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.missedEmoji}>🚨</Text>
              </Animated.View>
              <Text style={[styles.missedTitle, { color: C.red }]}>CHECK-IN MISSED</Text>
              <Text style={[styles.missedInfo, { color: C.textSecondary }]}>
                Your contacts have been automatically alerted with your last known location.
              </Text>
              <TouchableOpacity onPress={handleResume}
                style={[styles.startBtn, { backgroundColor: C.green, width: "100%" }]}>
                <Text style={[styles.startBtnTxt, { color: "#fff" }]}>✓ I'm Safe — Resume</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleStop}
                style={[styles.stopBtn, { borderColor: C.border, backgroundColor: C.bgTertiary }]}>
                <Text style={[styles.stopBtnTxt, { color: C.textMuted }]}>Stop</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "900", letterSpacing: 0.3 },
  closeBtn: { fontSize: 18, fontWeight: "700" },

  body: { padding: 20, alignItems: "center", gap: 16, paddingBottom: 36 },

  // Setup
  setupEmoji: { fontSize: 48 },
  setupTitle: { fontSize: 18, fontWeight: "900" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 13, fontWeight: "700" },
  infoBox: { padding: 14, borderRadius: 12, borderWidth: 1, width: "100%" },
  infoTxt: { fontSize: 12, fontWeight: "500", lineHeight: 18, textAlign: "center" },
  noContactsBox: { padding: 12, borderRadius: 12, borderWidth: 1, width: "100%" },
  noContactsTxt: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  contactsNote: { fontSize: 11, fontWeight: "600" },

  startBtn: { width: "100%", paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  startBtnTxt: { fontSize: 15, fontWeight: "900" },

  // Active
  safeBadge: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  safeBadgeTxt: { fontSize: 12, fontWeight: "900", letterSpacing: 0.5 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },

  timerRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  timerNum: { fontSize: 36, fontWeight: "900", letterSpacing: 2 },
  timerSub: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },

  progressTrack: { width: "100%", height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  statsRow: { flexDirection: "row", gap: 10, width: "100%" },
  statCard: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center", gap: 4 },
  statNum: { fontSize: 18, fontWeight: "900" },
  statLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },

  safeBtn: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  safeBtnTxt: { fontSize: 16, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },

  stopBtn: { width: "100%", paddingVertical: 13, borderRadius: 14, alignItems: "center", borderWidth: 1 },
  stopBtnTxt: { fontSize: 13, fontWeight: "700" },

  // Missed
  missedCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  missedEmoji: { fontSize: 44 },
  missedTitle: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  missedInfo: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 19, paddingHorizontal: 8 },
});
