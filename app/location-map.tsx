import { useTheme } from "@/context/ThemeContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Circle, MapView, Marker } from "expo-maps";
import { useRouter } from "expo-router";
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

// ─── Types ────────────────────────────────────────────────────────────────────
interface TrustedMember {
  id: string;
  name: string;
  phone: string;
  relation?: string;
}

interface MemberLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  lastUpdated: string; // ISO
  isOnline: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const ACCENT_COLORS = ["#D4A017", "#3B82F6", "#22C55E", "#A855F7", "#EF4444"];

// ─── Pulsing dot for "you" marker ─────────────────────────────────────────────
function PulsingDot({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.5, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,   duration: 900, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 28, height: 28 }}>
      <Animated.View style={{ position: "absolute", width: 28, height: 28, borderRadius: 14, backgroundColor: color + "33", transform: [{ scale: pulse }] }} />
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: color, borderWidth: 2, borderColor: "#fff" }} />
    </View>
  );
}

// ─── Member list card ─────────────────────────────────────────────────────────
function MemberCard({
  member,
  loc,
  color,
  C,
  onLocate,
}: {
  member: TrustedMember;
  loc: MemberLocation | null;
  color: string;
  C: any;
  onLocate: () => void;
}) {
  return (
    <View style={[styles.memberCard, { backgroundColor: C.cardBg, borderColor: C.cardBorder }]}>
      <View style={[styles.memberAvatar, { backgroundColor: color + "22", borderColor: color + "55" }]}>
        <Text style={[styles.memberInitials, { color }]}>{initials(member.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.memberName, { color: C.textPrimary }]}>{member.name}</Text>
        {loc ? (
          <Text style={[styles.memberStatus, { color: loc.isOnline ? C.green : C.textDim }]}>
            {loc.isOnline ? "● Online" : "○ Offline"} · {timeAgo(loc.lastUpdated)}
          </Text>
        ) : (
          <Text style={[styles.memberStatus, { color: C.textDim }]}>Location not shared</Text>
        )}
      </View>
      {loc && (
        <TouchableOpacity onPress={onLocate} style={[styles.locateBtn, { backgroundColor: color + "22", borderColor: color + "44" }]}>
          <Text style={[styles.locateBtnTxt, { color }]}>Locate</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        onPress={() => Linking.openURL(`tel:${member.phone.replace(/\D/g, "")}`)}
        style={[styles.callBtn, { backgroundColor: C.greenDim, borderColor: C.green + "44" }]}
      >
        <Text style={{ color: C.green, fontSize: 14 }}>📞</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function LocationMapScreen() {
  const { theme: C } = useTheme();
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const mapRef       = useRef<any>(null);

  const [mapsAvailable, setMapsAvailable] = useState<boolean | null>(null);
  const [myLocation, setMyLocation]       = useState<{ latitude: number; longitude: number } | null>(null);
  const [members, setMembers]             = useState<TrustedMember[]>([]);
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [tracking, setTracking]           = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [lastUpdated, setLastUpdated]     = useState<string | null>(null);

  const watchRef = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    // expo-maps is available (imported at top)
    setMapsAvailable(true);
  }, []);

  useEffect(() => {
    if (mapsAvailable) {
      loadMembers();
      startTracking();
    }
    return () => watchRef.current?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsAvailable]);

  async function loadMembers() {
    const raw = await AsyncStorage.getItem("trusted_circle");
    if (raw) {
      const parsed: TrustedMember[] = JSON.parse(raw);
      setMembers(parsed);
      // Simulate member locations nearby for demo
      // In production, these come from your backend/realtime DB
      simulateMemberLocations(parsed);
    }
  }

  function simulateMemberLocations(m: TrustedMember[]) {
    if (!m.length) return;
    // Generate plausible nearby coords — replace with real backend data
    const locs: MemberLocation[] = m.map((mem, i) => ({
      id:          mem.id,
      name:        mem.name,
      latitude:    23.0225 + (Math.random() - 0.5) * 0.02,
      longitude:   72.5714 + (Math.random() - 0.5) * 0.02,
      lastUpdated: new Date(Date.now() - Math.random() * 600000).toISOString(),
      isOnline:    Math.random() > 0.3,
    }));
    setMemberLocations(locs);
  }

  async function startTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setPermissionDenied(true); return; }

      // Get initial position fast
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLocation(pos.coords);
      setLastUpdated(new Date().toISOString());
      centerOnMe(pos.coords);

      // Watch continuously
      watchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 20 },
        (loc) => {
          setMyLocation(loc.coords);
          setLastUpdated(new Date().toISOString());
        }
      );
    } catch {
      setPermissionDenied(true);
    }
  }

  function centerOnMe(coords?: { latitude: number; longitude: number }) {
    const target = coords ?? myLocation;
    if (!target) return;
    mapRef.current?.animateToRegion({
      latitude:       target.latitude,
      longitude:      target.longitude,
      latitudeDelta:  0.01,
      longitudeDelta: 0.01,
    }, 600);
  }

  function centerOnMember(loc: MemberLocation) {
    mapRef.current?.animateToRegion({
      latitude:       loc.latitude,
      longitude:      loc.longitude,
      latitudeDelta:  0.008,
      longitudeDelta: 0.008,
    }, 600);
  }

  function fitAll() {
    if (!myLocation && memberLocations.length === 0) return;
    const coords = [
      ...(myLocation ? [myLocation] : []),
      ...memberLocations.map((l) => ({ latitude: l.latitude, longitude: l.longitude })),
    ];
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
      animated: true,
    });
  }

  function toggleTracking() {
    if (tracking) {
      watchRef.current?.remove();
      watchRef.current = null;
    } else {
      startTracking();
    }
    setTracking(!tracking);
  }

  if (permissionDenied) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
        <View style={[styles.topNav, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.textPrimary }]}>Live Location</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.permDenied}>
          <Text style={styles.permEmoji}>📍</Text>
          <Text style={[styles.permTitle, { color: C.textPrimary }]}>Location Access Required</Text>
          <Text style={[styles.permBody, { color: C.textMuted }]}>
            Enable location permission to view your live location and share it with your trusted circle.
          </Text>
          <TouchableOpacity
            onPress={() => Linking.openSettings()}
            style={[styles.permBtn, { backgroundColor: C.gold }]}
          >
            <Text style={[styles.permBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mapsAvailable === false) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top }]}>
        <StatusBar barStyle={C.statusBarStyle} backgroundColor={C.bg} />
        <View style={[styles.topNav, { borderBottomColor: C.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.navTitle, { color: C.textPrimary }]}>Live Location</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.permDenied}>
          <Text style={styles.permEmoji}>🗺️</Text>
          <Text style={[styles.permTitle, { color: C.textPrimary }]}>Maps Not Available</Text>
          <Text style={[styles.permBody, { color: C.textMuted }]}>
            Maps are not supported in Expo Go. Please use a development build to access map features.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.permBtn, { backgroundColor: C.gold }]}
          >
            <Text style={[styles.permBtnTxt, { color: C.mode === "dark" ? "#0A0A0A" : "#fff" }]}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mapsAvailable === null) {
    return (
      <View style={[styles.root, { backgroundColor: C.bg, paddingTop: insets.top, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: C.textPrimary }}>Loading maps...</Text>
      </View>
    );
  }

  // Maps components already imported at top

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* Full-screen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude:       myLocation?.latitude  ?? 23.0225,
          longitude:      myLocation?.longitude ?? 72.5714,
          latitudeDelta:  0.05,
          longitudeDelta: 0.05,
        }}
      >
        {/* My location marker */}
        {myLocation && (
          <>
            <Circle
              center={myLocation}
              radius={150}
              fillColor={C.gold + "22"}
              strokeColor={C.gold + "55"}
              strokeWidth={1}
            />
            <Marker coordinate={myLocation} anchor={{ x: 0.5, y: 0.5 }} title="You">
              <PulsingDot color={C.gold} />
            </Marker>
          </>
        )}

        {/* Member markers */}
        {memberLocations.map((loc, i) => (
          <Marker
            key={loc.id}
            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            title={loc.name}
            description={timeAgo(loc.lastUpdated)}
          >
            <View style={[styles.memberMarker, { backgroundColor: ACCENT_COLORS[i % ACCENT_COLORS.length], borderColor: "#fff" }]}>
              <Text style={styles.memberMarkerTxt}>{initials(loc.name)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Top nav overlay */}
      <View style={[styles.topNavOverlay, { backgroundColor: C.bg + "F2", borderBottomColor: C.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.backBtn, { color: C.gold }]}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={[styles.navTitle, { color: C.textPrimary }]}>Live Location</Text>
          {lastUpdated && (
            <Text style={[styles.navSub, { color: C.textDim }]}>Updated {timeAgo(lastUpdated)}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={toggleTracking}
          style={[styles.trackingToggle, { backgroundColor: tracking ? C.greenDim : C.redDim, borderColor: tracking ? C.green : C.red }]}
        >
          <Text style={[styles.trackingTxt, { color: tracking ? C.green : C.red }]}>
            {tracking ? "● Live" : "○ Paused"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Floating map controls */}
      <View style={[styles.mapControls, { bottom: insets.bottom + (members.length > 0 ? 280 : 120) }]}>
        <TouchableOpacity onPress={() => centerOnMe()} style={[styles.mapBtn, { backgroundColor: C.bg, borderColor: C.border }]}>
          <Text style={{ fontSize: 18 }}>🎯</Text>
        </TouchableOpacity>
        {members.length > 0 && (
          <TouchableOpacity onPress={fitAll} style={[styles.mapBtn, { backgroundColor: C.bg, borderColor: C.border }]}>
            <Text style={{ fontSize: 18 }}>⊞</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom sheet — member list */}
      <View style={[styles.bottomSheet, { backgroundColor: C.bg, borderColor: C.border, paddingBottom: insets.bottom + 8 }]}>
        {/* Handle */}
        <View style={[styles.sheetHandle, { backgroundColor: C.border }]} />

        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: C.textPrimary }]}>Trusted Circle</Text>
          <TouchableOpacity onPress={() => router.push("/trusted-circle")}>
            <Text style={[styles.sheetManage, { color: C.gold }]}>Manage →</Text>
          </TouchableOpacity>
        </View>

        {members.length === 0 ? (
          <View style={styles.noMembers}>
            <Text style={[styles.noMembersTxt, { color: C.textMuted }]}>
              No trusted circle members yet.{" "}
              <Text style={{ color: C.gold }} onPress={() => router.push("/trusted-circle")}>Add people →</Text>
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.memberList}>
            {members.map((m, i) => {
              const loc = memberLocations.find((l) => l.id === m.id) ?? null;
              return (
                <MemberCard
                  key={m.id}
                  member={m}
                  loc={loc}
                  color={ACCENT_COLORS[i % ACCENT_COLORS.length]}
                  C={C}
                  onLocate={() => loc && centerOnMember(loc)}
                />
              );
            })}
          </ScrollView>
        )}

        {/* My location row */}
        {myLocation && (
          <TouchableOpacity
            onPress={() => Linking.openURL(`https://maps.google.com/?q=${myLocation.latitude},${myLocation.longitude}`)}
            style={[styles.myLocRow, { backgroundColor: C.goldMid, borderColor: C.gold + "55" }]}
          >
            <Text style={styles.myLocIcon}>📍</Text>
            <Text style={[styles.myLocTxt, { color: C.goldText }]}>
              {myLocation.latitude.toFixed(5)}, {myLocation.longitude.toFixed(5)}
            </Text>
            <Text style={[styles.myLocOpen, { color: C.gold }]}>Open →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topNavOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  topNav:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  backBtn:  { fontSize: 22, fontWeight: "700", width: 36 },
  navTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.5 },
  navSub:   { fontSize: 10, fontWeight: "500", textAlign: "center" },

  trackingToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  trackingTxt:    { fontSize: 11, fontWeight: "800" },

  mapControls: { position: "absolute", right: 16, gap: 10, zIndex: 10 },
  mapBtn:      { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },

  memberMarker:    { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  memberMarkerTxt: { fontSize: 10, fontWeight: "900", color: "#fff" },

  bottomSheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: { width: 36, height: 3, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle:  { fontSize: 13, fontWeight: "900", letterSpacing: 0.5 },
  sheetManage: { fontSize: 11, fontWeight: "700" },

  memberList: { gap: 10, paddingVertical: 4 },
  memberCard: { width: 220, borderRadius: 14, borderWidth: 1, padding: 12, gap: 10 },
  memberAvatar:   { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  memberInitials: { fontSize: 14, fontWeight: "900" },
  memberName:     { fontSize: 13, fontWeight: "800" },
  memberStatus:   { fontSize: 10, fontWeight: "600", marginTop: 1 },
  locateBtn:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  locateBtnTxt:   { fontSize: 10, fontWeight: "800" },
  callBtn:        { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  noMembers:    { paddingVertical: 12 },
  noMembersTxt: { fontSize: 12, fontWeight: "600", textAlign: "center" },

  myLocRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  myLocIcon: { fontSize: 14 },
  myLocTxt:  { flex: 1, fontSize: 11, fontWeight: "700" },
  myLocOpen: { fontSize: 11, fontWeight: "800" },

  // Permission denied
  permDenied: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  permEmoji:  { fontSize: 52 },
  permTitle:  { fontSize: 18, fontWeight: "900", textAlign: "center" },
  permBody:   { fontSize: 13, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  permBtn:    { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  permBtnTxt: { fontSize: 14, fontWeight: "900" },
});