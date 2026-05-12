import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type CallState = "ringing" | "active" | "ended" | "idle";

interface FakeCallModalProps {
  visible: boolean;
  onClose: () => void;
  callerName?: string;
}

export default function FakeCallModal({ visible, onClose, callerName: propCallerName }: FakeCallModalProps) {
  const { theme: C } = useTheme();
  const [callState, setCallState]   = useState<CallState>("idle");
  const [callerName, setCallerName] = useState(propCallerName ?? "Mom");
  const [callDuration, setCallDuration] = useState(0);

  const soundRef         = useRef<Audio.Sound | null>(null);
  const pulseAnim        = useRef(new Animated.Value(1)).current;
  const pulseLoop        = useRef<Animated.CompositeAnimation | null>(null);
  const durationRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const hapticIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseLoop.current?.stop();
    Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [pulseAnim]);

  const stopSound = useCallback(async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }, []);

  const stopHaptics = useCallback(() => {
    if (hapticIntervalRef.current) { clearInterval(hapticIntervalRef.current); hapticIntervalRef.current = null; }
  }, []);

  const startRinging = useCallback(async () => {
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require("@/assets/sounds/ringtone.mp3"),
        { isLooping: true, volume: 1.0 }
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch {}
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    hapticIntervalRef.current = setInterval(async () => {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 1200);
  }, []);

  const stopAll = useCallback(() => {
    stopPulse();
    stopSound();
    stopHaptics();
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
  }, [stopPulse, stopSound, stopHaptics]);

  const handleCleanup = useCallback(() => {
    stopAll();
    setCallState("idle");
    setCallDuration(0);
  }, [stopAll]);

  // Reload caller name every time modal opens — picks up latest saved name
  useEffect(() => {
    if (visible) {
      if (propCallerName) {
        setCallerName(propCallerName);
      } else {
        AsyncStorage.getItem("fake_caller_name").then((v) => {
          if (v) setCallerName(v);
        });
      }
      setCallState("ringing");
      setCallDuration(0);
      startPulse();
      startRinging();
    } else {
      handleCleanup();
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (callState === "active") {
      stopPulse();
      durationRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    if (callState === "ended") {
      stopAll();
      // Just close — no full-screen ended state
      setTimeout(() => { onClose(); }, 600);
    }
    return () => { if (durationRef.current) clearInterval(durationRef.current); };
  }, [callState]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAnswer() {
    stopHaptics();
    await stopSound();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCallState("active");
  }

  async function handleDecline() {
    stopHaptics();
    await stopSound();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setCallState("ended");
  }

  async function handleHangUp() {
    stopHaptics();
    await stopSound();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setCallState("ended");
  }

  function formatDuration(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const initials = callerName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDecline}>
      <View style={[styles.fullScreen, { backgroundColor: callState === "active" ? C.bgSecondary : C.bg }]}>

        {/* ── RINGING ── */}
        {(callState === "ringing" || callState === "idle") && (
          <View style={styles.callScreen}>
            <View style={styles.callerInfo}>
              <Text style={[styles.incomingLabel, { color: C.textMuted }]}>INCOMING CALL</Text>
              <Animated.View style={[styles.avatarRingOuter, { borderColor: C.gold + "33", transform: [{ scale: pulseAnim }] }]}>
                <View style={[styles.avatarRingInner, { borderColor: C.gold + "66" }]}>
                  <View style={[styles.avatar, { backgroundColor: C.goldMid }]}>
                    <Text style={[styles.avatarTxt, { color: C.goldText }]}>{initials}</Text>
                  </View>
                </View>
              </Animated.View>
              <Text style={[styles.callerName, { color: C.textPrimary }]}>{callerName}</Text>
              <Text style={[styles.callerSub, { color: C.textMuted }]}>Mobile · India</Text>
              <View style={styles.ringingRow}>
                {[0, 1, 2].map((i) => <RingingDot key={i} delay={i * 200} C={C} />)}
              </View>
            </View>
            <View style={styles.callBtns}>
              <View style={styles.callBtnWrap}>
                <TouchableOpacity onPress={handleDecline} style={[styles.callBtn, { backgroundColor: C.red }]} activeOpacity={0.8}>
                  <Text style={styles.callBtnIcon}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>Decline</Text>
              </View>
              <View style={styles.callBtnWrap}>
                <TouchableOpacity onPress={handleAnswer} style={[styles.callBtn, { backgroundColor: C.green }]} activeOpacity={0.8}>
                  <Text style={styles.callBtnIcon}>✓</Text>
                </TouchableOpacity>
                <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>Answer</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── ACTIVE ── */}
        {callState === "active" && (
          <View style={styles.callScreen}>
            <View style={styles.callerInfo}>
              <Text style={[styles.connectedLabel, { color: C.green }]}>● CONNECTED</Text>
              <View style={[styles.avatar, { backgroundColor: C.goldMid }]}>
                <Text style={[styles.avatarTxt, { color: C.goldText }]}>{initials}</Text>
              </View>
              <Text style={[styles.callerName, { color: C.textPrimary }]}>{callerName}</Text>
              <Text style={[styles.timerTxt, { color: C.gold }]}>{formatDuration(callDuration)}</Text>
            </View>
            <View style={styles.activeControls}>
              <View style={styles.controlsRow}>
                <View style={[styles.controlBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
                  <Text style={[styles.controlIcon, { color: C.textMuted }]}>🔇</Text>
                  <Text style={[styles.controlLabel, { color: C.textDim }]}>Mute</Text>
                </View>
                <View style={[styles.controlBtn, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
                  <Text style={[styles.controlIcon, { color: C.textMuted }]}>🔊</Text>
                  <Text style={[styles.controlLabel, { color: C.textDim }]}>Speaker</Text>
                </View>
              </View>
              <View style={styles.callBtnWrap}>
                <TouchableOpacity onPress={handleHangUp} style={[styles.callBtn, { backgroundColor: C.red }]} activeOpacity={0.8}>
                  <Text style={styles.callBtnIcon}>✕</Text>
                </TouchableOpacity>
                <Text style={[styles.callBtnLabel, { color: C.textMuted }]}>End Call</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── ENDED — minimal, just closes ── */}
        {callState === "ended" && (
          <View style={styles.endedState}>
            <Text style={[styles.endedTxt, { color: C.textMuted }]}>CALL ENDED</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function RingingDot({ delay, C }: { delay: number; C: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(opacity, { toValue: 1,   duration: 350, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.3, duration: 350, useNativeDriver: true }),
      Animated.delay(700 - delay),
    ])).start();
  }, [delay, opacity]);
  return <Animated.View style={[styles.ringingDot, { backgroundColor: C.gold, opacity }]} />;
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1 },
  callScreen: { flex: 1, justifyContent: "space-between", paddingTop: 80, paddingBottom: 60, paddingHorizontal: 32 },
  callerInfo: { alignItems: "center", gap: 14 },
  incomingLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  connectedLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  avatarRingOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarRingInner: { width: 116, height: 116, borderRadius: 58, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  avatar: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 32, fontWeight: "900" },
  callerName: { fontSize: 28, fontWeight: "900", letterSpacing: 0.3, marginTop: 4 },
  callerSub: { fontSize: 14, fontWeight: "500" },
  ringingRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  ringingDot: { width: 8, height: 8, borderRadius: 4 },
  timerTxt: { fontSize: 34, fontWeight: "800", letterSpacing: 2, marginTop: 8 },
  callBtns: { flexDirection: "row", justifyContent: "center", gap: 64 },
  callBtnWrap: { alignItems: "center", gap: 12 },
  callBtn: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  callBtnIcon: { color: "#fff", fontSize: 26, fontWeight: "900" },
  callBtnLabel: { fontSize: 13, fontWeight: "600" },
  activeControls: { alignItems: "center", gap: 32 },
  controlsRow: { flexDirection: "row", gap: 24 },
  controlBtn: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, gap: 4 },
  controlIcon: { fontSize: 24 },
  controlLabel: { fontSize: 10, fontWeight: "700" },
  endedState: { flex: 1, alignItems: "center", justifyContent: "center" },
  endedTxt: { fontSize: 14, fontWeight: "800", letterSpacing: 2 },
});