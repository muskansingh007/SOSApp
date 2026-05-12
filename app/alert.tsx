import { RotatingTips } from "@/components/RotatingTips";
import { useTheme } from "@/context/ThemeContext";
import {
  cancelLocationUpdateNotifications,
  registerForPushNotifications,
  sendSMSSentNotification,
  sendSOSCancelledNotification,
  sendSOSTriggerNotification,
} from "@/utils/notifications";
import {
  startSOSRecording,
  stopSOSRecording,
} from "@/utils/sosActions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SMS from "expo-sms";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Contact {
  id?: string;
  name: string;
  phone: string;
  relation?: string;
}

type AlertPhase = "countdown" | "sending" | "active" | "cancelled";

function CountdownRing({ seconds, total, C }: { seconds: number; total: number; C: any }) {
  const SIZE = 200;
  const STROKE = 6;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}>
      <View style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: STROKE, borderColor: C.redDim }} />
      <View style={{ position: "absolute", width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: STROKE, borderColor: C.red, opacity: total > 0 ? seconds / total : 0 }} />
      <View style={styles.countdownInner}>
        <Text style={[styles.countdownNum, { color: C.red }]}>{seconds}</Text>
        <Text style={[styles.countdownLabel, { color: C.textMuted }]}>seconds</Text>
      </View>
    </View>
  );
}

function ContactAlertRow({ contact, index, status, C }: {
  contact: Contact; index: number;
  status: "pending" | "sent" | "failed" | "calling"; C: any;
}) {
  const ACCENT    = ["gold", "blue", "green", "purple", "red"] as const;
  const ACCENT_BG = ["goldMid", "blueDim", "greenDim", "purpleDim", "redDim"] as const;
  const color     = C[ACCENT[index % ACCENT.length]];
  const bg        = C[ACCENT_BG[index % ACCENT_BG.length]];
  const initials  = contact.name.split(" ").map((w) => w[0]).filter(Boolean).join("").toUpperCase().slice(0, 2);
  const statusConfig = {
    pending: { label: "Pending...",    color: C.textDim, bg: C.bgTertiary },
    sending: { label: "Sending...",    color: C.gold,    bg: C.goldMid    },
    sent:    { label: "✓ Alert Sent",  color: C.green,   bg: C.greenDim   },
    failed:  { label: "✕ Failed",      color: C.red,     bg: C.redDim     },
    calling: { label: "📞 Calling...", color: C.blue,    bg: C.blueDim    },
  };
  const s = statusConfig[status];
  return (
    <View style={[styles.contactRow, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={[styles.contactAvatar, { backgroundColor: bg }]}>
        <Text style={[styles.contactInitials, { color }]}>{initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.contactName, { color: C.textPrimary }]}>{contact.name}</Text>
        <Text style={[styles.contactPhone, { color: C.textMuted }]}>{contact.phone}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.color + "55" }]}>
        <Text style={[styles.statusTxt, { color: s.color }]}>{s.label}</Text>
      </View>
    </View>
  );
}

export default function AlertScreen() {
  const { theme: C } = useTheme();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const params       = useLocalSearchParams();

  const [phase, setPhase]                     = useState<AlertPhase>("countdown");
  const [countdown, setCountdown]             = useState(3);
  const [contacts, setContacts]               = useState<Contact[]>([]);
  const [contactStatuses, setContactStatuses] = useState<Record<number, "pending" | "sent" | "failed" | "calling">>({});
  const [location, setLocation]               = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationUrl, setLocationUrl]         = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds]   = useState(0);
  const [alertTime, setAlertTime]             = useState("");
  const [audioRecording, setAudioRecording]   = useState(false);

  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const flashAnim     = useRef(new Animated.Value(1)).current;
  const cancelled     = useRef(false);
  const settingsRef   = useRef<Record<string, any>>({});
  const countdownTotal = useRef(3);

  useEffect(() => {
    loadAll();
    startPulse();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase === "active") {
      startFlash();
      startElapsedTimer();
      setAlertTime(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function loadAll() {
    const raw = await AsyncStorage.getItem("settings");
    settingsRef.current = raw ? JSON.parse(raw) : {};
    await loadContacts();
    await fetchLocation();
    if (settingsRef.current.notificationsEnabled !== false) {
      registerForPushNotifications().catch(() => {});
    }
    startCountdown();
  }

  async function loadContacts() {
    if (params.contacts) {
      const parsed = JSON.parse(params.contacts as string);
      setContacts(parsed);
      initStatuses(parsed.length);
    } else {
      const v = await AsyncStorage.getItem("contacts");
      if (v) { const parsed = JSON.parse(v); setContacts(parsed); initStatuses(parsed.length); }
    }
  }

  function initStatuses(count: number) {
    const s: Record<number, "pending"> = {};
    for (let i = 0; i < count; i++) s[i] = "pending";
    setContactStatuses(s);
  }

  async function fetchLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(loc.coords);
      setLocationUrl(`https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`);
    } catch {}
  }

  function startCountdown() {
    const duration = settingsRef.current.countdownDuration ?? 3;
    countdownTotal.current = duration;
    setCountdown(duration);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (cancelled.current) { clearInterval(countdownRef.current!); return prev; }
        if (prev <= 1) { clearInterval(countdownRef.current!); triggerSOS(); return 0; }
        if (settingsRef.current.soundEnabled !== false) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
        return prev - 1;
      });
    }, 1000);
  }

  function startPulse() {
    Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,    duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
  }

  function startFlash() {
    Animated.loop(Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 1,   duration: 800, useNativeDriver: true }),
    ])).start();
  }

  function startElapsedTimer() {
    elapsedRef.current = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
  }

  async function triggerSOS() {
    if (cancelled.current) return;
    setPhase("sending");

    const settings = settingsRef.current;
    const soundOn  = settings.soundEnabled !== false;
    const notifsOn = settings.notificationsEnabled !== false;

    if (soundOn) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // ── Auto Audio Recording ──────────────────────────────────────────────────
    if (settings.autoAudioRecording) {
      try {
        const started = await startSOSRecording();
        if (started) setAudioRecording(true);
      } catch {}
    }

    // ── Location ──────────────────────────────────────────────────────────────
    let currentCoords = location;
    let currentUrl    = locationUrl;
    if (!currentCoords) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          currentCoords = loc.coords;
          currentUrl    = `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`;
          setLocation(loc.coords);
          setLocationUrl(currentUrl);
        }
      } catch {}
    }

    // ── Push notification ─────────────────────────────────────────────────────
    if (notifsOn && currentCoords) {
      sendSOSTriggerNotification(currentCoords).catch(() => {});
    }

    // ── Build & send SMS ──────────────────────────────────────────────────────
    const sosMessage      = settings.sosMessage ?? "🆘 I need help! This is an emergency.";
    const includeLocation = settings.includeLocationLink !== false;
    const time            = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    const locationPart    = includeLocation && currentUrl ? `\n📍 My location: ${currentUrl}` : "";
    const fullMessage     = `${sosMessage}\n\nSent at ${time}.${locationPart}`;

    const contactList: Contact[] =
      contacts.length > 0
        ? contacts
        : JSON.parse((await AsyncStorage.getItem("contacts")) ?? "[]");

    for (let i = 0; i < contactList.length; i++) {
      setContactStatuses((prev) => ({ ...prev, [i]: "pending" }));
    }

    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable && contactList.length > 0) {
      try {
        await SMS.sendSMSAsync(contactList.map((c) => c.phone), fullMessage);
        const sent: Record<number, "sent"> = {};
        contactList.forEach((_, i) => { sent[i] = "sent"; });
        setContactStatuses(sent);
        if (notifsOn) sendSMSSentNotification(contactList.length).catch(() => {});
      } catch {
        const failed: Record<number, "failed"> = {};
        contactList.forEach((_, i) => { failed[i] = "failed"; });
        setContactStatuses(failed);
      }
    }

    // ── Auto-call first contact ───────────────────────────────────────────────
    if (settings.autoCallContacts !== false && contactList.length > 0) {
      setTimeout(() => {
        setContactStatuses((prev) => ({ ...prev, 0: "calling" }));
        Linking.openURL(`tel:${contactList[0].phone.replace(/\D/g, "")}`).then(() => {
          setTimeout(() => setContactStatuses((prev) => ({ ...prev, 0: "sent" })), 3000);
        });
      }, 1500);
    }

    setPhase("active");
  }

  function handleCancel() {
    if (phase !== "countdown") return;
    cancelled.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    setPhase("cancelled");
    if (settingsRef.current.soundEnabled !== false) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => router.back(), 1500);
  }

  async function handleDismiss() {
    // Stop audio recording if active
    if (audioRecording) {
      try { await stopSOSRecording(); } catch {}
      setAudioRecording(false);
    }
    if (settingsRef.current.notificationsEnabled !== false) {
      cancelLocationUpdateNotifications().catch(() => {});
      sendSOSCancelledNotification().catch(() => {});
    }
    cleanup();
    router.back();
  }

  function handleCallContact(phone: string) {
    Linking.openURL(`tel:${phone.replace(/\D/g, "")}`);
  }

  function cleanup() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (elapsedRef.current)   clearInterval(elapsedRef.current);
    pulseAnim.stopAnimation();
    flashAnim.stopAnimation();
  }

  function formatElapsed(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return (
    <View style={[styles.root, { backgroundColor: phase === "active" ? C.redDim : C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={phase === "active" ? "#1A0000" : C.bg} />

      <View style={[styles.topNav, { borderBottomColor: phase === "active" ? C.red + "33" : C.border }]}>
        <View style={styles.brandRow}>
          <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
          <View style={[styles.brandDot, { backgroundColor: C.red }]} />
          <Text style={[styles.brandLetter, { color: C.red }]}>O</Text>
          <View style={[styles.brandDot, { backgroundColor: C.red }]} />
          <Text style={[styles.brandLetter, { color: C.textPrimary }]}>S</Text>
        </View>
        <Animated.View style={{ opacity: flashAnim }}>
          <Text style={[styles.navPhaseLabel, {
            color: phase === "active" ? C.red : phase === "countdown" ? C.gold : C.green,
          }]}>
            {phase === "countdown" ? "● COUNTDOWN"
              : phase === "sending" ? "● SENDING"
              : phase === "active"  ? "● SOS ACTIVE"
              :                       "● CANCELLED"}
          </Text>
        </Animated.View>
      </View>

      {/* Recording indicator */}
      {audioRecording && phase === "active" && (
        <View style={[styles.recordingBar, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
          <View style={[styles.recDot, { backgroundColor: C.red }]} />
          <Text style={[styles.recTxt, { color: C.red }]}>Audio REC</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
      >
        {/* ════ COUNTDOWN ════ */}
        {phase === "countdown" && (
          <View style={styles.centeredSection}>
            <Text style={[styles.phaseTitle, { color: C.textMuted }]}>SOS TRIGGERING IN</Text>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <CountdownRing seconds={countdown} total={countdownTotal.current} C={C} />
            </Animated.View>
            <Text style={[styles.phaseHint, { color: C.textMuted }]}>Release to cancel — contacts will be alerted</Text>
            <TouchableOpacity onPress={handleCancel} style={[styles.cancelBtn, { backgroundColor: C.bgSecondary, borderColor: C.border }]}>
              <Text style={[styles.cancelBtnTxt, { color: C.textPrimary }]}>✕ Cancel SOS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ════ SENDING ════ */}
        {phase === "sending" && (
          <View style={styles.centeredSection}>
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View style={[styles.sendingCircle, { backgroundColor: C.redDim, borderColor: C.red }]}>
                <Text style={styles.sendingEmoji}>🆘</Text>
              </View>
            </Animated.View>
            <Text style={[styles.phaseTitle, { color: C.red }]}>SENDING ALERTS</Text>
            <Text style={[styles.phaseHint, { color: C.textMuted }]}>Notifying your emergency contacts...</Text>
          </View>
        )}

        {/* ════ ACTIVE ════ */}
        {phase === "active" && (
          <>
            <View style={styles.centeredSection}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <View style={[styles.activeCircle, { backgroundColor: C.redDim, borderColor: C.red }]}>
                  <Text style={styles.activeEmoji}>🆘</Text>
                  <Text style={[styles.activeTxt, { color: C.red }]}>SOS ACTIVE</Text>
                </View>
              </Animated.View>
              <View style={[styles.elapsedBadge, { backgroundColor: C.redDim, borderColor: C.red + "55" }]}>
                <Text style={[styles.elapsedTxt, { color: C.red }]}>⏱ {formatElapsed(elapsedSeconds)} elapsed</Text>
                <Text style={[styles.elapsedTime, { color: C.textMuted }]}>· Triggered at {alertTime}</Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>YOUR LOCATION</Text>
            <View style={[styles.locationCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              {location ? (
                <View style={styles.locationRow}>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.locationCoords, { color: C.textPrimary }]}>
                      {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    </Text>
                    <Text style={[styles.locationSub, { color: C.textMuted }]}>Shared with emergency contacts</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => locationUrl && Linking.openURL(locationUrl)}
                    style={[styles.openMapBtn, { backgroundColor: C.blueDim, borderColor: C.blue }]}
                  >
                    <Text style={[styles.openMapTxt, { color: C.blue }]}>Maps →</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.locationRow}>
                  <Text style={{ fontSize: 18 }}>📡</Text>
                  <Text style={[styles.locationSub, { color: C.textMuted }]}>Acquiring GPS location...</Text>
                </View>
              )}
            </View>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>CONTACTS ALERTED</Text>
            <View style={styles.contactsList}>
              {contacts.map((contact, i) => (
                <TouchableOpacity key={i} onPress={() => handleCallContact(contact.phone)} activeOpacity={0.8}>
                  <ContactAlertRow contact={contact} index={i} status={contactStatuses[i] ?? "pending"} C={C} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.tapToCall, { color: C.textDim }]}>Tap a contact to call them directly</Text>

            <RotatingTips C={C} />

            <TouchableOpacity onPress={() => Linking.openURL("tel:112")} style={[styles.call112Btn, { backgroundColor: C.red }]}>
              <Text style={styles.call112Txt}>📞 Call 112 — National Emergency</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleDismiss} style={[styles.dismissBtn, { borderColor: C.border, backgroundColor: C.bgSecondary }]}>
              <Text style={[styles.dismissTxt, { color: C.textMuted }]}>I'm Safe — Dismiss Alert</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ════ CANCELLED ════ */}
        {phase === "cancelled" && (
          <View style={styles.centeredSection}>
            <View style={[styles.cancelledCircle, { backgroundColor: C.greenDim, borderColor: C.green }]}>
              <Text style={styles.cancelledEmoji}>✓</Text>
            </View>
            <Text style={[styles.phaseTitle, { color: C.green }]}>SOS CANCELLED</Text>
            <Text style={[styles.phaseHint, { color: C.textMuted }]}>No alerts were sent. Going back...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  brandLetter: { fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  brandDot: { width: 4, height: 4, borderRadius: 2 },
  navPhaseLabel: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  recordingBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  recDot: { width: 7, height: 7, borderRadius: 4 },
  recTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  scrollContent: { padding: 20 },
  centeredSection: { alignItems: "center", gap: 20, paddingVertical: 24 },
  countdownInner: { alignItems: "center" },
  countdownNum: { fontSize: 80, fontWeight: "900", lineHeight: 88 },
  countdownLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 2 },
  phaseTitle: { fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  phaseHint: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  cancelBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16, borderWidth: 1, marginTop: 8 },
  cancelBtnTxt: { fontSize: 15, fontWeight: "800" },
  sendingCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  sendingEmoji: { fontSize: 56 },
  activeCircle: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 4 },
  activeEmoji: { fontSize: 52 },
  activeTxt: { fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  elapsedBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  elapsedTxt: { fontSize: 13, fontWeight: "800" },
  elapsedTime: { fontSize: 11, fontWeight: "500" },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginTop: 20, marginBottom: 10, marginLeft: 4 },
  locationCard: { borderRadius: 14, borderWidth: 1, padding: 14 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  locationCoords: { fontSize: 13, fontWeight: "700", marginBottom: 2 },
  locationSub: { fontSize: 11, fontWeight: "500" },
  openMapBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  openMapTxt: { fontSize: 11, fontWeight: "800" },
  contactsList: { gap: 8 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  contactAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  contactInitials: { fontSize: 15, fontWeight: "900" },
  contactName: { fontSize: 13, fontWeight: "800", marginBottom: 2 },
  contactPhone: { fontSize: 11, fontWeight: "500" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  statusTxt: { fontSize: 10, fontWeight: "800" },
  tapToCall: { fontSize: 10, fontWeight: "600", textAlign: "center", marginTop: 6 },
  call112Btn: { marginTop: 20, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  call112Txt: { color: "#fff", fontSize: 15, fontWeight: "900" },
  dismissBtn: { marginTop: 10, paddingVertical: 14, borderRadius: 16, alignItems: "center", borderWidth: 1 },
  dismissTxt: { fontSize: 13, fontWeight: "700" },
  cancelledCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cancelledEmoji: { fontSize: 48, color: "#22C55E" },
});