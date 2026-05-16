import { ThemedAlert, useThemedAlert } from "@/components/ThemedAlert";
import { useTheme } from "@/context/ThemeContext";
import { useScrollToTop } from "@/hooks/useScrollToTop";
import { getFeedbackSettings } from "@/utils/appSettings";
import { sendLocalNotification } from "@/utils/notifications";
import { playEmergencySound, playSuccessSound } from "@/utils/soundEffects";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import * as SMS from "expo-sms";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Lazy-load MapView
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let Circle: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Polyline = maps.Polyline;
  Circle = maps.Circle;
} catch {}

interface Contact { name: string; phone: string; }
interface Coords { latitude: number; longitude: number; }
type WalkState = "setup" | "active" | "arrived" | "alert";
const DURATIONS = [5, 10, 15, 20, 30, 45, 60];

// ─── Live Map ─────────────────────────────────────────────────────────────────
function WalkMap({ currentLocation, routeCoords, destination, C }: {
  currentLocation: Coords | null; routeCoords: Coords[]; destination: string; C: any;
}) {
  if (!MapView || !currentLocation) {
    return (
      <View style={[ms.fallback, { backgroundColor: C.bgTertiary, borderColor: C.border }]}>
        <Text style={{ fontSize: 28 }}>🗺️</Text>
        <Text style={[ms.fallbackTxt, { color: C.textMuted }]}>{currentLocation ? "Map loading…" : "Getting GPS…"}</Text>
        {currentLocation && (
          <Text style={[ms.coordsTxt, { color: C.textDim }]}>
            {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={ms.container}>
      <MapView style={ms.map}
        region={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }}
        showsUserLocation showsMyLocationButton={false} showsCompass={false}>
        <Circle center={currentLocation} radius={30} fillColor={C.gold + "33"} strokeColor={C.gold + "88"} strokeWidth={2} />
        {routeCoords.length > 1 && <Polyline coordinates={routeCoords} strokeColor={C.blue} strokeWidth={4} />}
        <Marker coordinate={currentLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={[ms.myDot, { backgroundColor: C.gold, borderColor: C.bg }]} />
        </Marker>
      </MapView>
      {destination.trim().length > 0 && (
        <View style={[ms.destOverlay, { backgroundColor: C.bg + "EE", borderColor: C.border }]}>
          <Text style={{ fontSize: 12 }}>📍</Text>
          <Text style={[ms.destTxt, { color: C.textPrimary }]} numberOfLines={1}>{destination}</Text>
        </View>
      )}
      <TouchableOpacity style={[ms.openBtn, { backgroundColor: C.blue }]}
        onPress={() => {
          const url = Platform.OS === "ios"
            ? `maps://?saddr=${currentLocation.latitude},${currentLocation.longitude}&daddr=${destination || "destination"}`
            : `geo:${currentLocation.latitude},${currentLocation.longitude}?q=${encodeURIComponent(destination || "destination")}`;
          Linking.openURL(url).catch(() =>
            Linking.openURL(`https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`)
          );
        }}>
        <Text style={ms.openBtnTxt}>Open in Maps ↗</Text>
      </TouchableOpacity>
    </View>
  );
}

const ms = StyleSheet.create({
  container: { height: 220, borderRadius: 16, overflow: "hidden", position: "relative" },
  map: { flex: 1 },
  fallback: { height: 220, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  fallbackTxt: { fontSize: 13, fontWeight: "600" },
  coordsTxt: { fontSize: 10, fontWeight: "500" },
  myDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  destOverlay: { position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  destTxt: { flex: 1, fontSize: 12, fontWeight: "700" },
  openBtn: { position: "absolute", bottom: 10, right: 10, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  openBtnTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function WalkHomeScreen() {
  const { theme: C } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scrollRef = useScrollToTop();
  const { visible, config, hideAlert } = useThemedAlert();

  const [walkState, setWalkState] = useState<WalkState>("setup");
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [destination, setDestination] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coords | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coords[]>([]);
  const [locationUrl, setLocationUrl] = useState<string | null>(null);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<Animated.CompositeAnimation | null>(null);
  const locationWatcher = useRef<Location.LocationSubscription | null>(null);
  const keepAwakeActive = useRef(false);
  const cleanupRequested = useRef(false);
  const feedbackRef = useRef({ notificationsEnabled: true, soundEnabled: true });

  const cleanup = useCallback(() => {
    cleanupRequested.current = true;
    stopTimer(); releaseScreenLock();
    locationWatcher.current?.remove(); locationWatcher.current = null;
  }, []);

  useEffect(() => { loadContacts(); loadFeedbackSettings(); return () => cleanup(); }, [cleanup]);

  async function loadFeedbackSettings() {
    feedbackRef.current = await getFeedbackSettings();
  }

  async function playNotificationFeedback(type: Haptics.NotificationFeedbackType) {
    if (feedbackRef.current.soundEnabled) {
      await Haptics.notificationAsync(type);
    }
  }

  async function playImpactFeedback(style: Haptics.ImpactFeedbackStyle) {
    if (feedbackRef.current.soundEnabled) {
      await Haptics.impactAsync(style);
    }
  }

  useEffect(() => {
    if (walkState === "alert") {
      Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
    } else { pulseAnim.stopAnimation(); pulseAnim.setValue(1); }
  }, [walkState, pulseAnim]);

  async function loadContacts() {
    const v = await AsyncStorage.getItem("contacts");
    if (v) setContacts(JSON.parse(v));
  }

  async function startLocationTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const initialCoords = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
      setCurrentLocation(initialCoords);
      setRouteCoords([initialCoords]);
      setLocationUrl(`https://maps.google.com/?q=${initialCoords.latitude},${initialCoords.longitude}`);
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 5000 },
        (loc) => {
          const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
          setCurrentLocation(coords);
          setLocationUrl(`https://maps.google.com/?q=${coords.latitude},${coords.longitude}`);
          setRouteCoords((prev) => [...prev, coords]);
        }
      );
      locationWatcher.current = sub;
    } catch {}
  }

  async function startWalk() {
    if (contacts.length === 0) return;
    cleanupRequested.current = false;
    setWalkState("active");
    setRouteCoords([]);
    const totalSecs = durationMinutes * 60;
    setTimeLeft(totalSecs);
    startTimer(totalSecs);
    startProgress(totalSecs);
    await activateScreenLock();
    await startLocationTracking();
    const msg = buildStartMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
    await playNotificationFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();
    void sendLocalNotification("Walk Home Started", `Expected arrival in ${durationMinutes} minutes.`);
  }

  function startTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); triggerAlert(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }

  function startProgress(totalSeconds: number) {
    progressAnim.setValue(1);
    progressRef.current = Animated.timing(progressAnim, { toValue: 0, duration: totalSeconds * 1000, easing: Easing.linear, useNativeDriver: false });
    progressRef.current.start();
  }

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    progressRef.current?.stop(); progressRef.current = null;
  }

  async function extendTime() {
    stopTimer();
    const newTotal = timeLeft + 10 * 60;
    setTimeLeft(newTotal); startTimer(newTotal); startProgress(newTotal);
    await playImpactFeedback(Haptics.ImpactFeedbackStyle.Light);
    void sendLocalNotification("Walk Home Extended", "Added 10 minutes to your walk timer.");
  }

  async function markArrived() {
    stopTimer(); cleanup(); setWalkState("arrived");
    await playNotificationFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();
    const msg = buildArrivalMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
    void sendLocalNotification("Arrived Safely", "Walk Home ended and your contacts were updated.");
    setTimeout(() => router.back(), 2500);
  }

  async function triggerAlert() {
    setWalkState("alert");
    await playNotificationFeedback(Haptics.NotificationFeedbackType.Error);
    void playEmergencySound();
    const msg = buildAlertMessage();
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) await SMS.sendSMSAsync(contacts.map((c) => c.phone), msg);
    void sendLocalNotification("Walk Home Alert", "Your emergency contacts were alerted.");
  }

  async function imSafe() {
    stopTimer(); cleanup(); setWalkState("arrived");
    await playNotificationFeedback(Haptics.NotificationFeedbackType.Success);
    void playSuccessSound();
    void sendLocalNotification("Walk Home Cancelled", "You marked yourself safe.");
    setTimeout(() => router.back(), 2000);
  }

  async function activateScreenLock() {
    try { await activateKeepAwakeAsync(); keepAwakeActive.current = true; if (cleanupRequested.current) releaseScreenLock(); } catch {}
  }
  function releaseScreenLock() {
    if (!keepAwakeActive.current) return;
    keepAwakeActive.current = false; deactivateKeepAwake().catch(() => {});
  }

  function buildStartMessage() {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return `🚶 Walk Home started at ${time}. Expected arrival in ${durationMinutes} min${destination ? ` to ${destination}` : ""}. ${locationUrl ? `Live location: ${locationUrl}` : ""}`;
  }
  function buildArrivalMessage() {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return `✅ Arrived safely at ${time}${destination ? ` — ${destination}` : ""}. Walk Home ended.`;
  }
  function buildAlertMessage() {
    const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return `🚨 SOS: Walk Home timer expired at ${time}${destination ? ` (destination: ${destination})` : ""}. ${locationUrl ? `Last location: ${locationUrl}` : "No location available."}`;
  }
  function formatTime(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  const progressWidth = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const progressColor = progressAnim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [C.red, "#EF9F27", C.blue] });

  return (
    <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
      <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />

      <View style={[styles.topNav, { borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => { cleanup(); router.back(); }} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: C.textPrimary }]}>Walk Home Mode</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}>

        {/* ── SETUP ── */}
        {walkState === "setup" && (
          <>
            <View style={[styles.heroCard, { backgroundColor: C.blueDim, borderColor: C.blue + "44" }]}>
              <Text style={styles.heroEmoji}>🚶</Text>
              <Text style={[styles.heroTitle, { color: C.blue }]}>Walk Home Mode</Text>
              <Text style={[styles.heroBody, { color: C.textSecondary }]}>
                Contacts notified when you start. Your live route is tracked on the map. Auto-SOS if you don't confirm arrival.
              </Text>
            </View>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader }]}>DESTINATION</Text>
            <TextInput value={destination} onChangeText={setDestination}
              placeholder="e.g. Home, Hostel, Station..."
              placeholderTextColor={C.textDim}
              style={[styles.input, { backgroundColor: C.inputBg, borderColor: destination ? C.blue : C.inputBorder, color: C.textPrimary }]} />

            <Text style={[styles.sectionLabel, { color: C.sectionHeader, marginTop: 20 }]}>WALK DURATION</Text>
            <View style={[styles.card, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
              <View style={styles.durationGrid}>
                {DURATIONS.map((min) => (
                  <TouchableOpacity key={min} onPress={() => setDurationMinutes(min)}
                    style={[styles.chip, { backgroundColor: durationMinutes === min ? C.blueDim : C.bgTertiary, borderColor: durationMinutes === min ? C.blue : C.border }]}>
                    <Text style={[styles.chipTxt, { color: durationMinutes === min ? C.blue : C.textMuted }]}>
                      {min < 60 ? `${min}m` : `${min / 60}h`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader, marginTop: 20 }]}>HOW IT WORKS</Text>
            <View style={styles.infoCards}>
              {[
                { color: C.blue, bg: C.blueDim, text: "Contacts notified when walk starts" },
                { color: C.green, bg: C.greenDim, text: "Live GPS route shown on map" },
                { color: "#EF9F27", bg: C.goldMid, text: "Tap +10 min if you need more time" },
                { color: C.red, bg: C.redDim, text: "Auto-SOS if you don't tap Arrived" },
              ].map((info, i) => (
                <View key={i} style={[styles.infoCard, { backgroundColor: info.bg, borderColor: info.color + "44" }]}>
                  <View style={[styles.infoDot, { backgroundColor: info.color }]} />
                  <Text style={[styles.infoTxt, { color: C.textSecondary }]}>{info.text}</Text>
                </View>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader, marginTop: 20 }]}>ALERTING</Text>
            {contacts.length === 0 ? (
              <View style={[styles.noContactsCard, { backgroundColor: C.redDim, borderColor: C.red + "44" }]}>
                <Text style={[styles.noContactsTxt, { color: C.red }]}>⚠ No emergency contacts set.</Text>
                <TouchableOpacity onPress={() => router.push("/contacts")} style={[styles.addContactBtn, { backgroundColor: C.red }]}>
                  <Text style={styles.addContactBtnTxt}>Add Contacts →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.contactsList}>
                {contacts.slice(0, 3).map((c, i) => (
                  <View key={i} style={[styles.contactRow, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
                    <View style={[styles.contactDot, { backgroundColor: C.blueDim }]}>
                      <Text style={[styles.contactInitial, { color: C.blue }]}>{c.name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.contactName, { color: C.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.contactPhone, { color: C.textMuted }]}>{c.phone}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity onPress={startWalk} disabled={contacts.length === 0}
              style={[styles.startBtn, { backgroundColor: contacts.length === 0 ? C.bgTertiary : C.blue, marginTop: 28 }]}>
              <Text style={[styles.startBtnTxt, { color: contacts.length === 0 ? C.textMuted : "#fff" }]}>🚶 Start Walk Home</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── ACTIVE ── */}
        {walkState === "active" && (
          <View style={styles.activeContainer}>
            <View style={[styles.activeBadge, { backgroundColor: C.blueDim, borderColor: C.blue }]}>
              <View style={[styles.activeDot, { backgroundColor: C.blue }]} />
              <Text style={[styles.activeBadgeTxt, { color: C.blue }]}>WALK ACTIVE</Text>
            </View>

            <View style={{ width: "100%" }}>
              <Text style={[styles.sectionLabel, { color: C.sectionHeader, marginTop: 0, marginBottom: 8 }]}>LIVE ROUTE</Text>
              <WalkMap currentLocation={currentLocation} routeCoords={routeCoords} destination={destination} C={C} />
            </View>

            <View style={[styles.timerRing, { borderColor: C.blue }]}>
              <Text style={[styles.timerNum, { color: C.blue }]}>{formatTime(timeLeft)}</Text>
              <Text style={[styles.timerSub, { color: C.textMuted }]}>remaining</Text>
            </View>

            <View style={[styles.progressTrack, { backgroundColor: C.bgTertiary }]}>
              <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: progressColor }]} />
            </View>

            {destination !== "" && (
              <View style={[styles.destBadge, { backgroundColor: C.blueDim, borderColor: C.blue }]}>
                <Text style={{ fontSize: 12 }}>📍</Text>
                <Text style={[styles.destBadgeTxt, { color: C.blue }]}>{destination}</Text>
              </View>
            )}

            <TouchableOpacity onPress={markArrived} style={[styles.arrivedBtn, { backgroundColor: C.green }]}>
              <Text style={styles.arrivedBtnTxt}>✓ I ARRIVED SAFELY</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={extendTime} style={[styles.extendBtn, { borderColor: C.blue, backgroundColor: C.blueDim }]}>
              <Text style={[styles.extendBtnTxt, { color: C.blue }]}>+ 10 min</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: C.sectionHeader, marginTop: 8, alignSelf: "flex-start" }]}>ALERTING</Text>
            <View style={[styles.contactsList, { width: "100%" }]}>
              {contacts.slice(0, 3).map((c, i) => (
                <View key={i} style={[styles.contactRow, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
                  <View style={[styles.contactDot, { backgroundColor: C.blueDim }]}>
                    <Text style={[styles.contactInitial, { color: C.blue }]}>{c.name[0].toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.contactName, { color: C.textPrimary }]}>{c.name}</Text>
                  <Text style={[styles.contactPhone, { color: C.textMuted }]}>{c.phone}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── ALERT ── */}
        {walkState === "alert" && (
          <View style={styles.activeContainer}>
            <Animated.View style={[styles.alertCircle, { backgroundColor: C.redDim, borderColor: C.red, transform: [{ scale: pulseAnim }] }]}>
              <Text style={styles.alertEmoji}>🚨</Text>
            </Animated.View>
            <Text style={[styles.alertTitle, { color: C.red }]}>ALERT SENT</Text>
            <Text style={[styles.alertInfo, { color: C.textSecondary }]}>
              Your contacts have been notified with your last known location. Are you safe?
            </Text>
            {currentLocation && (
              <View style={{ width: "100%" }}>
                <WalkMap currentLocation={currentLocation} routeCoords={routeCoords} destination={destination} C={C} />
              </View>
            )}
            <TouchableOpacity onPress={imSafe} style={[styles.startBtn, { backgroundColor: C.green, width: "100%" }]}>
              <Text style={[styles.startBtnTxt, { color: "#fff" }]}>✓ I'm Safe — Cancel Alert</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ARRIVED ── */}
        {walkState === "arrived" && (
          <View style={styles.activeContainer}>
            <View style={[styles.arrivedCircle, { backgroundColor: C.greenDim, borderColor: C.green }]}>
              <Text style={styles.arrivedEmoji}>✓</Text>
            </View>
            <Text style={[styles.arrivedTitle, { color: C.green }]}>ARRIVED SAFELY</Text>
            <Text style={[styles.arrivedSub, { color: C.textMuted }]}>Contacts notified. Going back…</Text>
          </View>
        )}
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
  scrollContent: { padding: 16 },
  heroCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 8, marginBottom: 4 },
  heroEmoji: { fontSize: 40, marginBottom: 4 },
  heroTitle: { fontSize: 18, fontWeight: "900" },
  heroBody: { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 19 },
  sectionLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 2, marginBottom: 10, marginLeft: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 13, fontWeight: "600" },
  card: { borderRadius: 14, borderWidth: 1, padding: 16 },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipTxt: { fontSize: 13, fontWeight: "700" },
  infoCards: { gap: 8 },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  infoDot: { width: 6, height: 6, borderRadius: 3 },
  infoTxt: { fontSize: 12, fontWeight: "600", flex: 1 },
  noContactsCard: { padding: 16, borderRadius: 14, borderWidth: 1, gap: 12, alignItems: "flex-start" },
  noContactsTxt: { fontSize: 13, fontWeight: "700" },
  addContactBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  addContactBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  contactsList: { gap: 8 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  contactDot: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  contactInitial: { fontSize: 13, fontWeight: "900" },
  contactName: { flex: 1, fontSize: 13, fontWeight: "700" },
  contactPhone: { fontSize: 11, fontWeight: "500" },
  startBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  startBtnTxt: { fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  activeContainer: { alignItems: "center", gap: 16, paddingTop: 12 },
  activeBadge: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  activeBadgeTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  timerRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  timerNum: { fontSize: 38, fontWeight: "900", letterSpacing: 2 },
  timerSub: { fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 4 },
  progressTrack: { width: "100%", height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  destBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  destBadgeTxt: { fontSize: 12, fontWeight: "700" },
  arrivedBtn: { width: "100%", paddingVertical: 18, borderRadius: 16, alignItems: "center" },
  arrivedBtnTxt: { fontSize: 15, fontWeight: "900", color: "#fff", letterSpacing: 0.5 },
  extendBtn: { paddingHorizontal: 32, paddingVertical: 12, borderRadius: 20, borderWidth: 1 },
  extendBtnTxt: { fontSize: 14, fontWeight: "700" },
  alertCircle: { width: 120, height: 120, borderRadius: 60, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  alertEmoji: { fontSize: 48 },
  alertTitle: { fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  alertInfo: { fontSize: 13, fontWeight: "600", textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  arrivedCircle: { width: 110, height: 110, borderRadius: 55, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  arrivedEmoji: { fontSize: 44, color: "#22C55E" },
  arrivedTitle: { fontSize: 20, fontWeight: "900", letterSpacing: 1 },
  arrivedSub: { fontSize: 13, fontWeight: "600" },
});
