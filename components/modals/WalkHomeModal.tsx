import { useTheme } from "@/context/ThemeContext";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import * as SMS from "expo-sms";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Contact {
  name: string;
  phone: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

type WalkState = "setup" | "active" | "extending" | "arrived" | "alert";

export default function WalkHomeModal({ visible, onClose }: Props) {
  const { theme: C } = useTheme();
  const [walkState, setWalkState] = useState<WalkState>("setup");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [destination, setDestination] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [location, setLocation] = useState<string | null>(null);
  const [locationWatcher, setLocationWatcher] =
    useState<Location.LocationSubscription | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const keepAwakeActiveRef = useRef(false);
  const cleanupRequestedRef = useRef(false);

  const DURATIONS = [5, 10, 15, 20, 30, 45, 60];

  // ── Lifecycle ──
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
      loadContacts();
    } else {
      fadeAnim.setValue(0);
      cleanup();
      setWalkState("setup");
    }
    // This effect intentionally follows modal visibility only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Pulse for alert state ──
  useEffect(() => {
    if (walkState === "alert") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
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
  }, [walkState, pulseAnim]);

  async function loadContacts() {
    const v = await AsyncStorage.getItem("contacts");
    if (v) setContacts(JSON.parse(v));
  }

  async function startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 20 },
        (loc) => {
          setLocation(
            `https://maps.google.com/?q=${loc.coords.latitude},${loc.coords.longitude}`
          );
        }
      );
      setLocationWatcher(sub);
    } catch {}
  }

  async function startWalk() {
    if (contacts.length === 0) return;
    cleanupRequestedRef.current = false;
    setWalkState("active");
    const totalSecs = durationMinutes * 60;
    setTimeLeft(totalSecs);
    startTimer(totalSecs);
    startProgress(totalSecs);
    await activateScreenLock();
    await startLocationTracking();

    // Notify contacts walk has started
    const msg = buildStartMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      await SMS.sendSMSAsync(
        contacts.map((c) => c.phone),
        msg
      );
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          triggerAlert();
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
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    progressRef.current?.stop();
    progressRef.current = null;
  }

  async function extendTime() {
    stopTimer();
    const newTotal = timeLeft + 10 * 60;
    setTimeLeft(newTotal);
    startTimer(newTotal);
    startProgress(newTotal);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function markArrived() {
    stopTimer();
    cleanup();
    setWalkState("arrived");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const msg = buildArrivalMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      await SMS.sendSMSAsync(
        contacts.map((c) => c.phone),
        msg
      );
    }

    setTimeout(() => onClose(), 2500);
  }

  async function triggerAlert() {
    setWalkState("alert");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

    const msg = buildAlertMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      await SMS.sendSMSAsync(
        contacts.map((c) => c.phone),
        msg
      );
    }
  }

  async function imSafe() {
    stopTimer();
    cleanup();
    setWalkState("arrived");
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => onClose(), 2000);
  }

  function cleanup() {
    cleanupRequestedRef.current = true;
    stopTimer();
    releaseScreenLock();
    locationWatcher?.remove();
    setLocationWatcher(null);
  }

  async function activateScreenLock() {
    try {
      await activateKeepAwakeAsync();
      keepAwakeActiveRef.current = true;
      if (cleanupRequestedRef.current) {
        releaseScreenLock();
      }
    } catch {}
  }

  function releaseScreenLock() {
    if (!keepAwakeActiveRef.current) return;
    keepAwakeActiveRef.current = false;
    deactivateKeepAwake().catch(() => {});
  }

  function buildStartMessage() {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `🚶 Walk Home started at ${time}. Expected arrival in ${durationMinutes} min${
      destination ? ` to ${destination}` : ""
    }. ${location ? `Live location: ${location}` : ""}`;
  }

  function buildArrivalMessage() {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `✅ Arrived safely at ${time}${
      destination ? ` — ${destination}` : ""
    }. Walk Home ended.`;
  }

  function buildAlertMessage() {
    const time = new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `🚨 SOS: Walk Home timer expired at ${time} without check-in${
      destination ? ` (destination: ${destination})` : ""
    }. ${location ? `Last location: ${location}` : "No location available."}`;
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
    inputRange: [0, 0.2, 1],
    outputRange: [C.red, "#EF9F27", C.blue],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: C.bgSecondary, borderColor: C.cardBorder },
          ]}
        >
          {/* ── Header ── */}
          <View style={[styles.header, { borderBottomColor: C.border }]}>
            <View style={styles.headerLeft}>
              <View
                style={[styles.headerIcon, { backgroundColor: C.blueDim }]}
              >
                <WalkIcon color={C.blue} />
              </View>
              <View>
                <Text style={[styles.title, { color: C.textPrimary }]}>
                  Walk Home Mode
                </Text>
                <Text style={[styles.subtitle, { color: C.textMuted }]}>
                  {walkState === "active"
                    ? "Tracking your route"
                    : walkState === "alert"
                    ? "Alert triggered!"
                    : "Auto-SOS if timer expires"}
                </Text>
              </View>
            </View>
            {walkState === "setup" && (
              <TouchableOpacity onPress={onClose} hitSlop={12}>
                <Text style={[styles.closeBtn, { color: C.textMuted }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.body}
          >
            {/* ── SETUP ── */}
            {walkState === "setup" && (
              <>
                <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>
                  WALK DURATION
                </Text>
                <View style={styles.durationGrid}>
                  {DURATIONS.map((min) => (
                    <TouchableOpacity
                      key={min}
                      onPress={() => setDurationMinutes(min)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor:
                            durationMinutes === min ? C.blueDim : C.bgTertiary,
                          borderColor:
                            durationMinutes === min ? C.blue : C.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipTxt,
                          {
                            color:
                              durationMinutes === min ? C.blue : C.textMuted,
                          },
                        ]}
                      >
                        {min < 60 ? `${min}m` : `${min / 60}h`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text
                  style={[
                    styles.sectionLabel,
                    { color: C.sectionHeader, marginTop: 16 },
                  ]}
                >
                  DESTINATION (OPTIONAL)
                </Text>
                <TextInput
                  value={destination}
                  onChangeText={setDestination}
                  placeholder="e.g. Home, Hostel, Station..."
                  style={[
                    styles.input,
                    {
                      backgroundColor: C.inputBg,
                      borderColor: C.inputBorder,
                      color: C.textPrimary,
                    },
                  ]}
                  placeholderTextColor={C.textMuted}
                />

                {/* Info cards */}
                <View style={styles.infoCards}>
                  <InfoCard
                    C={C}
                    color={C.blue}
                    bg={C.blueDim}
                    text="Contacts notified when walk starts"
                  />
                  <InfoCard
                    C={C}
                    color={C.green}
                    bg={C.greenDim}
                    text="Live GPS location shared every 20m"
                  />
                  <InfoCard
                    C={C}
                    color={C.red}
                    bg={C.redDim}
                    text="Auto-SOS if you don't tap Arrived"
                  />
                </View>

                {contacts.length === 0 && (
                  <Text style={[styles.noContacts, { color: C.red }]}>
                    ⚠ No emergency contacts set
                  </Text>
                )}

                <TouchableOpacity
                  onPress={startWalk}
                  disabled={contacts.length === 0}
                  style={[
                    styles.primaryBtn,
                    {
                      backgroundColor:
                        contacts.length === 0 ? C.bgTertiary : C.blue,
                      marginTop: 20,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.primaryBtnTxt,
                      { color: contacts.length === 0 ? C.textMuted : "#fff" },
                    ]}
                  >
                    Start Walk
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── ACTIVE ── */}
            {walkState === "active" && (
              <View style={styles.centered}>
                {/* Timer */}
                <View style={[styles.timerRing, { borderColor: C.blue }]}>
                  <Text style={[styles.timerNum, { color: C.blue }]}>
                    {formatTime(timeLeft)}
                  </Text>
                  <Text style={[styles.timerSub, { color: C.textMuted }]}>
                    remaining
                  </Text>
                </View>

                {/* Progress */}
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

                {destination !== "" && (
                  <Text style={[styles.destTxt, { color: C.textMuted }]}>
                    → {destination}
                  </Text>
                )}

                {location && (
                  <View
                    style={[
                      styles.locBadge,
                      { backgroundColor: C.blueDim, borderColor: C.blue },
                    ]}
                  >
                    <Text style={[styles.locTxt, { color: C.blue }]}>
                      ● GPS Active
                    </Text>
                  </View>
                )}

                {/* Arrived button */}
                <TouchableOpacity
                  onPress={markArrived}
                  style={[styles.arrivedBtn, { backgroundColor: C.green }]}
                >
                  <Text style={styles.arrivedBtnTxt}>✓ I ARRIVED SAFELY</Text>
                </TouchableOpacity>

                {/* Extend */}
                <TouchableOpacity
                  onPress={extendTime}
                  style={[
                    styles.extendBtn,
                    { borderColor: C.blue, backgroundColor: C.blueDim },
                  ]}
                >
                  <Text style={[styles.extendBtnTxt, { color: C.blue }]}>
                    + 10 min
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── ALERT ── */}
            {walkState === "alert" && (
              <View style={styles.centered}>
                <Animated.View
                  style={[
                    styles.alertCircle,
                    {
                      backgroundColor: C.redDim,
                      borderColor: C.red,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  <Text style={styles.alertEmoji}>🚨</Text>
                </Animated.View>

                <Text style={[styles.alertTitle, { color: C.red }]}>
                  ALERT SENT
                </Text>
                <Text style={[styles.alertInfo, { color: C.textSecondary }]}>
                  Your contacts have been notified with your last known location.
                  Are you safe?
                </Text>

                <TouchableOpacity
                  onPress={imSafe}
                  style={[styles.primaryBtn, { backgroundColor: C.green, width: "100%" }]}
                >
                  <Text style={[styles.primaryBtnTxt, { color: "#fff" }]}>
                    I'm Safe — Cancel Alert
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── ARRIVED ── */}
            {walkState === "arrived" && (
              <View style={styles.centered}>
                <View
                  style={[
                    styles.arrivedCircle,
                    { backgroundColor: C.greenDim, borderColor: C.green },
                  ]}
                >
                  <Text style={styles.arrivedEmoji}>✓</Text>
                </View>
                <Text style={[styles.arrivedTitle, { color: C.green }]}>
                  ARRIVED SAFELY
                </Text>
                <Text style={[styles.arrivedSub, { color: C.textMuted }]}>
                  Contacts notified. Closing...
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── Info card helper ──
function InfoCard({
  C,
  color,
  bg,
  text,
}: {
  C: any;
  color: string;
  bg: string;
  text: string;
}) {
  return (
    <View
      style={[
        styles.infoCard,
        { backgroundColor: bg, borderColor: color + "44" },
      ]}
    >
      <View style={[styles.infoDot, { backgroundColor: color }]} />
      <Text style={[styles.infoTxt, { color: C.textSecondary }]}>{text}</Text>
    </View>
  );
}

// ── Walk icon ──
function WalkIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 16, height: 18, alignItems: "center" }}>
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
          marginBottom: 2,
        }}
      />
      <View
        style={{ width: 2, height: 8, backgroundColor: color, borderRadius: 1 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 22,
    borderWidth: 1,
    maxHeight: "90%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontWeight: "800", letterSpacing: 0.3 },
  subtitle: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  closeBtn: { fontSize: 15, fontWeight: "700" },
  body: { padding: 20, paddingBottom: 28 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
  },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipTxt: { fontSize: 12, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 13,
    fontWeight: "600",
  },
  infoCards: { gap: 8, marginTop: 16 },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoDot: { width: 6, height: 6, borderRadius: 3 },
  infoTxt: { fontSize: 12, fontWeight: "600", flex: 1 },
  noContacts: { fontSize: 12, fontWeight: "700", marginTop: 8 },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryBtnTxt: { fontSize: 14, fontWeight: "800" },
  centered: { alignItems: "center", gap: 14 },
  timerRing: {
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  timerNum: { fontSize: 34, fontWeight: "900", letterSpacing: 2 },
  timerSub: { fontSize: 9, fontWeight: "700", letterSpacing: 1.5, marginTop: 2 },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  destTxt: { fontSize: 12, fontWeight: "600" },
  locBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  locTxt: { fontSize: 11, fontWeight: "700" },
  arrivedBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  arrivedBtnTxt: {
    fontSize: 14,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: 0.5,
  },
  extendBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  extendBtnTxt: { fontSize: 13, fontWeight: "700" },
  alertCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  alertEmoji: { fontSize: 36 },
  alertTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  alertInfo: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 20,
  },
  arrivedCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  arrivedEmoji: { fontSize: 36, color: "#22C55E" },
  arrivedTitle: { fontSize: 18, fontWeight: "900", letterSpacing: 1 },
  arrivedSub: { fontSize: 12, fontWeight: "600" },
});
