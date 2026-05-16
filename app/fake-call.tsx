import { useTheme } from "@/context/ThemeContext";
import { getFeedbackSettings } from "@/utils/appSettings";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
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
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Types ────────────────────────────────────────────────────────────────────
type CallState = "setup" | "countdown" | "ringing" | "active" | "ended";

const DELAY_OPTIONS = [
  { label: "Instant", value: 0 },
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "5 min", value: 300 },
];

// ─── Incoming Call UI ─────────────────────────────────────────────────────────
function IncomingCallUI({
  C,
  callerName,
  pulseAnim,
  onAnswer,
  onDecline,
}: {
  C: any;
  callerName: string;
  pulseAnim: Animated.Value;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const initials = callerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.callScreen}>
      {/* Caller info */}
      <View style={styles.callerInfo}>
        <Text style={[styles.incomingLabel, { color: C.textMuted }]}>
          INCOMING CALL
        </Text>
        <Animated.View
          style={[
            styles.avatarRing,
            {
              borderColor: C.gold,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: C.goldMid }]}>
            <Text style={[styles.avatarTxt, { color: C.goldText }]}>
              {initials}
            </Text>
          </View>
        </Animated.View>
        <Text style={[styles.callerName, { color: C.textPrimary }]}>
          {callerName}
        </Text>
        <Text style={[styles.callerSub, { color: C.textMuted }]}>
          Mobile · India
        </Text>
      </View>

      {/* Call buttons */}
      <View style={styles.callBtns}>
        <View style={styles.callBtnWrap}>
          <TouchableOpacity
            onPress={onDecline}
            style={[styles.callBtn, { backgroundColor: C.red }]}
          >
            <Text style={styles.callBtnIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>
            Decline
          </Text>
        </View>
        <View style={styles.callBtnWrap}>
          <TouchableOpacity
            onPress={onAnswer}
            style={[styles.callBtn, { backgroundColor: C.green }]}
          >
            <Text style={styles.callBtnIcon}>✓</Text>
          </TouchableOpacity>
          <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>
            Answer
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Active Call UI ───────────────────────────────────────────────────────────
function ActiveCallUI({
  C,
  callerName,
  duration,
  onEnd,
}: {
  C: any;
  callerName: string;
  duration: number;
  onEnd: () => void;
}) {
  const initials = callerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <View style={styles.callScreen}>
      <View style={styles.callerInfo}>
        <Text style={[styles.connectedLabel, { color: C.green }]}>
          ● CONNECTED
        </Text>
        <View style={[styles.avatar, { backgroundColor: C.goldMid }]}>
          <Text style={[styles.avatarTxt, { color: C.goldText }]}>
            {initials}
          </Text>
        </View>
        <Text style={[styles.callerName, { color: C.textPrimary }]}>
          {callerName}
        </Text>
        <Text style={[styles.timerTxt, { color: C.gold }]}>
          {formatDuration(duration)}
        </Text>
      </View>

      {/* End call */}
      <View style={styles.callBtns}>
        <View style={styles.callBtnWrap}>
          <TouchableOpacity
            onPress={onEnd}
            style={[styles.callBtn, { backgroundColor: C.red }]}
          >
            <Text style={styles.callBtnIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>
            End Call
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FakeCallScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [callState, setCallState] = useState<CallState>("setup");
  const [callerName, setCallerName] = useState("Mom");
  const [delaySeconds, setDelaySeconds] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [callDuration, setCallDuration] = useState(0);

  const soundRef = useRef<Audio.Sound | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef({ notificationsEnabled: true, soundEnabled: true });

  useEffect(() => {
    // Load saved caller name
    AsyncStorage.getItem("fake_caller_name").then((v) => {
      if (v) setCallerName(v);
    });
    return () => cleanup();
    // Runs only on mount/unmount so timers and audio are cleaned once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pulse when ringing ──
  useEffect(() => {
    if (callState === "ringing") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(1);
    }
  }, [callState, pulseAnim]);

  async function handleStartFakeCall() {
    // Save caller name
    await AsyncStorage.setItem("fake_caller_name", callerName);

    if (delaySeconds > 0) {
      setCallState("countdown");
      setCountdown(delaySeconds);
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            beginRinging();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      beginRinging();
    }
  }

  async function beginRinging() {
    setCallState("ringing");
    const feedback = await getFeedbackSettings();
    feedbackRef.current = feedback;
    if (!feedback.soundEnabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/ringtone.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}

    // Haptic pulse while ringing
    hapticIntervalRef.current = setInterval(async () => {
      if (callState === "ringing") {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
        hapticIntervalRef.current = null;
      }
    }, 1200);
  }

  async function handleAnswer() {
    await stopSound();
    stopHaptics();
    setCallState("active");
    setCallDuration(0);
    durationRef.current = setInterval(() => {
      setCallDuration((d) => d + 1);
    }, 1000);
    if (feedbackRef.current.soundEnabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleDecline() {
    await stopSound();
    stopHaptics();
    setCallState("ended");
    if (feedbackRef.current.soundEnabled) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    setTimeout(() => router.back(), 1000);
  }

  async function handleEndCall() {
    if (durationRef.current) clearInterval(durationRef.current);
    stopHaptics();
    setCallState("ended");
    setTimeout(() => router.back(), 1000);
  }

  async function stopSound() {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  }

  function cleanup() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (durationRef.current) clearInterval(durationRef.current);
    stopHaptics();
    stopSound();
  }

  function stopHaptics() {
    if (hapticIntervalRef.current) {
      clearInterval(hapticIntervalRef.current);
      hapticIntervalRef.current = null;
    }
  }

  function handleCancelCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCallState("setup");
  }

  // ── Full screen call states ──
  if (callState === "ringing") {
    return (
      <View
        style={[
          styles.fullScreen,
          { backgroundColor: C.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
        <IncomingCallUI
          C={C}
          callerName={callerName}
          pulseAnim={pulseAnim}
          onAnswer={handleAnswer}
          onDecline={handleDecline}
        />
      </View>
    );
  }

  if (callState === "active") {
    return (
      <View
        style={[
          styles.fullScreen,
          { backgroundColor: C.bgSecondary, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bgSecondary} />
        <ActiveCallUI
          C={C}
          callerName={callerName}
          duration={callDuration}
          onEnd={handleEndCall}
        />
      </View>
    );
  }

  if (callState === "ended") {
    return (
      <View
        style={[
          styles.fullScreen,
          { backgroundColor: C.bg, paddingTop: insets.top },
        ]}
      >
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
        <View style={styles.endedState}>
          <Text style={[styles.endedTxt, { color: C.textMuted }]}>
            CALL ENDED
          </Text>
        </View>
      </View>
    );
  }

  // ── SETUP & COUNTDOWN ──
  return (
    <View
      style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}
    >
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      {/* ── Top Nav ── */}
      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>
          Fake Call
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
        {/* ── COUNTDOWN state ── */}
        {callState === "countdown" && (
          <View style={styles.countdownState}>
            <Text style={[styles.countdownLabel, { color: C.textMuted }]}>
              FAKE CALL INCOMING IN
            </Text>
            <Text style={[styles.countdownNum, { color: C.gold }]}>
              {countdown}
            </Text>
            <Text style={[styles.countdownSub, { color: C.textMuted }]}>
              seconds
            </Text>
            <TouchableOpacity
              onPress={handleCancelCountdown}
              style={[
                styles.cancelCountdownBtn,
                { backgroundColor: C.bgTertiary, borderColor: C.border },
              ]}
            >
              <Text style={[styles.cancelCountdownTxt, { color: C.textMuted }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── SETUP state ── */}
        {callState === "setup" && (
          <>
            {/* Hero */}
            <View
              style={[
                styles.heroCard,
                { backgroundColor: C.goldMid, borderColor: C.gold + "44" },
              ]}
            >
              <Text style={styles.heroEmoji}>📞</Text>
              <Text style={[styles.heroTitle, { color: C.goldText }]}>
                Fake Call
              </Text>
              <Text style={[styles.heroBody, { color: C.textSecondary }]}>
                Simulate an incoming call to escape uncomfortable situations
                discreetly.
              </Text>
            </View>

            {/* Caller name */}
            <Text
              style={[styles.sectionLabel, { color: C.sectionHeader }]}
            >
              CALLER NAME
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: C.cardBg, borderColor: C.cardBorder },
              ]}
            >
              <TextInput
                value={callerName}
                onChangeText={setCallerName}
                placeholder="e.g. Mom, Boss, Dr. Mehta..."
                placeholderTextColor={C.textDim}
                autoCapitalize="words"
                style={[
                  styles.input,
                  {
                    backgroundColor: C.inputBg,
                    borderColor: C.inputBorder,
                    color: C.textPrimary,
                  },
                ]}
              />
              {/* Quick name suggestions */}
              <View style={styles.suggestionRow}>
                {["Mom", "Dad", "Boss", "Doctor"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setCallerName(s)}
                    style={[
                      styles.suggestionChip,
                      {
                        backgroundColor:
                          callerName === s ? C.goldMid : C.bgTertiary,
                        borderColor: callerName === s ? C.gold : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.suggestionTxt,
                        {
                          color: callerName === s ? C.goldText : C.textMuted,
                        },
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Delay */}
            <Text
              style={[
                styles.sectionLabel,
                { color: C.sectionHeader, marginTop: 20 },
              ]}
            >
              CALL DELAY
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: C.cardBg, borderColor: C.cardBorder },
              ]}
            >
              <View style={styles.delayGrid}>
                {DELAY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    onPress={() => setDelaySeconds(opt.value)}
                    style={[
                      styles.delayChip,
                      {
                        backgroundColor:
                          delaySeconds === opt.value
                            ? C.goldMid
                            : C.bgTertiary,
                        borderColor:
                          delaySeconds === opt.value ? C.gold : C.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.delayChipTxt,
                        {
                          color:
                            delaySeconds === opt.value
                              ? C.goldText
                              : C.textMuted,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {delaySeconds > 0 && (
                <Text style={[styles.delayHint, { color: C.textMuted }]}>
                  💡 Put your phone away — the call will ring in {delaySeconds < 60
                    ? `${delaySeconds} seconds`
                    : `${delaySeconds / 60} minute${delaySeconds > 60 ? "s" : ""}`}
                </Text>
              )}
            </View>

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
                { icon: "📞", text: "A realistic incoming call screen appears" },
                { icon: "✓", text: "Answer to show an active call timer" },
                { icon: "✕", text: "Decline to dismiss naturally" },
                { icon: "🔔", text: "Ringtone plays with vibration" },
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

            {/* Start button */}
            <TouchableOpacity
              onPress={handleStartFakeCall}
              style={[styles.startBtn, { backgroundColor: C.gold, marginTop: 28 }]}
            >
              <Text
                style={[
                  styles.startBtnTxt,
                  { color: C.mode === "dark" ? "#0A0A0A" : "#fff" },
                ]}
              >
                📞 {delaySeconds > 0 ? `Start — Rings in ${delaySeconds < 60
                  ? `${delaySeconds}s`
                  : `${delaySeconds / 60}m`}` : "Start Fake Call Now"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  fullScreen: { flex: 1 },

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
    gap: 12,
  },

  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
  },

  suggestionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  suggestionTxt: { fontSize: 12, fontWeight: "700" },

  delayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  delayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  delayChipTxt: { fontSize: 12, fontWeight: "700" },
  delayHint: { fontSize: 11, fontWeight: "500", lineHeight: 16 },

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

  startBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  startBtnTxt: { fontSize: 15, fontWeight: "900" },

  // Countdown
  countdownState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 8,
  },
  countdownLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  countdownNum: { fontSize: 96, fontWeight: "900", lineHeight: 104 },
  countdownSub: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  cancelCountdownBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
  },
  cancelCountdownTxt: { fontSize: 14, fontWeight: "700" },

  // Call screens
  callScreen: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  callerInfo: { alignItems: "center", gap: 12, flex: 1, justifyContent: "center" },
  incomingLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 2, marginBottom: 8 },
  connectedLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, marginBottom: 8 },
  avatarRing: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 32, fontWeight: "900" },
  callerName: { fontSize: 26, fontWeight: "900", letterSpacing: 0.3 },
  callerSub: { fontSize: 13, fontWeight: "500" },
  timerTxt: { fontSize: 32, fontWeight: "800", letterSpacing: 2, marginTop: 8 },

  callBtns: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 56,
    paddingBottom: 16,
  },
  callBtnWrap: { alignItems: "center", gap: 10 },
  callBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  callBtnIcon: { color: "#fff", fontSize: 24, fontWeight: "900" },
  callBtnLabel: { fontSize: 12, fontWeight: "600" },

  // Ended
  endedState: { flex: 1, alignItems: "center", justifyContent: "center" },
  endedTxt: { fontSize: 13, fontWeight: "800", letterSpacing: 2 },
});
